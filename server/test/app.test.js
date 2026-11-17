import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seedDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { initialTopics } from '../src/content.js';
import { diagnose, compareDiagnoses } from '../src/diagnosis.js';

let db, server, base;
before(async () => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  server = createApp(db);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});
function client() {
  let cookie = '';
  let csrf = '';
  return async (path, method = 'GET', body, extras = {}) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...extras,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0];
    if (response.headers.get('x-csrf-token')) csrf = response.headers.get('x-csrf-token');
    const type = response.headers.get('content-type') ?? '';
    return {
      status: response.status,
      headers: response.headers,
      body: type.includes('json') ? await response.json() : await response.text(),
    };
  };
}
const login = async (request, email) => {
  const r = await request('/auth/login', 'POST', { email, password: 'EduBridge123!' });
  assert.equal(r.status, 200);
  return r;
};

test('authentication, cookie security, role boundaries, and logout', async () => {
  const request = client();
  assert.equal((await request('/bootstrap')).status, 401);
  assert.equal(
    (
      await request('/auth/login', 'POST', {
        email: 'siswa@edubridge.id',
        password: 'incorrect123',
      })
    ).status,
    401,
  );
  const signed = await login(request, 'siswa@edubridge.id');
  assert.match(signed.headers.get('set-cookie'), /HttpOnly/);
  assert.match(signed.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal((await request('/admin/overview')).status, 403);
  assert.equal((await request('/classes')).status, 403);
  const bootstrap = await request('/bootstrap');
  assert.equal(bootstrap.body.user.role, 'student');
  assert.ok(bootstrap.body.topics.every((t) => !('pre' in t) && !('post' in t)));
  assert.equal(bootstrap.body.progress.xp, 260);
  assert.equal(bootstrap.body.progress.gapsClosed, 3);
  assert.equal(
    (
      await request(
        '/profile',
        'PATCH',
        { name: 'Nadia Putri', school: 'SMA EduBridge', reminders: true },
        { Origin: 'https://attacker.example' },
      )
    ).status,
    403,
  );
  assert.equal((await request('/auth/logout', 'POST', {})).status, 200);
  assert.equal((await request('/auth/me')).status, 401);
});

test('registration validates class, email uniqueness, and prevents privilege escalation', async () => {
  const request = client();
  const form = {
    name: 'Siswa Baru',
    email: 'baru@example.id',
    password: 'NewPassword123!',
    school: 'SMA Contoh',
    classCode: 'INVALID',
    agree: true,
    role: 'admin',
  };
  assert.equal((await request('/auth/register', 'POST', form)).status, 400);
  const registered = await request('/auth/register', 'POST', { ...form, classCode: 'BRIDGE11' });
  assert.equal(registered.status, 200);
  assert.equal(registered.body.user.role, 'student');
  const data = await request('/bootstrap');
  assert.equal(data.body.progress.xp, 0);
  assert.equal(data.body.progress.mastery, null);
  assert.equal(data.body.progress.gapCount, 0);
  assert.equal(
    (await client()('/auth/register', 'POST', { ...form, classCode: 'BRIDGE11' })).status,
    409,
  );
  assert.equal((await request('/admin/overview')).status, 403);
});

test('full learning cycle enforces pre → class learning → lesson → post, survives resume, and rewards once', async () => {
  const student = client();
  const teacher = client();
  await login(teacher, 'guru@edubridge.id');
  const reg = await student('/auth/register', 'POST', {
    name: 'Siklus Uji',
    email: 'siklus@example.id',
    password: 'Testing123!',
    school: 'SMA Uji',
    classCode: 'BRIDGE11',
    agree: true,
  });
  assert.equal(reg.status, 200);
  const topic = initialTopics.find((t) => t.id === 'aljabar');
  assert.equal(
    (await student('/assessments', 'POST', { topicId: topic.id, mode: 'posttest' })).status,
    409,
  );
  const started = await student('/assessments', 'POST', { topicId: topic.id, mode: 'pretest' });
  assert.equal(started.status, 200);
  const id = started.body.id;
  assert.ok(started.body.questions.every((q) => !('answer' in q) && !('explanation' in q)));
  assert.equal(
    (await student('/assessments', 'POST', { topicId: topic.id, mode: 'pretest' })).body.id,
    id,
  );
  const other = client();
  await login(other, 'siswa@edubridge.id');
  assert.equal((await other(`/assessments/${id}`)).status, 404);
  const partial = topic.pre.map((q, i) => (i === 0 ? q.answer : null));
  assert.equal((await student(`/assessments/${id}`, 'PATCH', { responses: partial })).status, 200);
  assert.deepEqual((await student(`/assessments/${id}`)).body.responses, partial);
  assert.equal(
    (await student(`/assessments/${id}/submit`, 'POST', { responses: partial })).status,
    400,
  );
  assert.equal(
    (await student(`/assessments/${id}`, 'PATCH', { responses: Array(6).fill(9) })).status,
    400,
  );
  assert.equal(
    (await student('/assistant', 'POST', { topicId: topic.id, message: 'Jelaskan matriks' }))
      .status,
    409,
  );
  const answers = topic.pre.map((q, i) => (i < 2 ? q.answer : (q.answer + 1) % 4));
  const submitted = await student(`/assessments/${id}/submit`, 'POST', { responses: answers });
  assert.equal(submitted.body.result.score, Math.round((2 / topic.pre.length) * 100));
  assert.equal(submitted.body.xp, 60);
  assert.equal(submitted.body.result.provider, 'pdina');
  assert.equal(submitted.body.result.gapCount, 3);
  assert.ok(submitted.body.questions.every((q) => Number.isInteger(q.answer) && q.explanation));
  await student(`/assessments/${id}/submit`, 'POST', { responses: answers });
  assert.equal((await student('/bootstrap')).body.progress.xp, 60);
  assert.equal(
    (await student('/assessments', 'POST', { topicId: topic.id, mode: 'pretest' })).status,
    409,
  );
  assert.equal((await student(`/topics/${topic.id}/lesson`, 'POST', {})).status, 409);
  await teacher('/classes/class-xi1/phase', 'PATCH', { topicId: topic.id, phase: 'learning' });
  assert.equal(
    (await student('/assessments', 'POST', { topicId: topic.id, mode: 'posttest' })).status,
    409,
  );
  assert.equal((await student(`/topics/${topic.id}/lesson`, 'POST', {})).status, 200);
  await student(`/topics/${topic.id}/lesson`, 'POST', {});
  assert.equal((await student('/bootstrap')).body.progress.xp, 100);
  assert.equal(
    (await student('/assessments', 'POST', { topicId: topic.id, mode: 'posttest' })).status,
    409,
  );
  const chat = await student('/assistant', 'POST', {
    topicId: topic.id,
    message: 'Jelaskan determinan',
  });
  assert.equal(chat.body.simulated, false);
  assert.equal(chat.body.fallback, true);
  await teacher('/classes/class-xi1/phase', 'PATCH', { topicId: topic.id, phase: 'posttest' });
  const post = await student('/assessments', 'POST', { topicId: topic.id, mode: 'posttest' });
  assert.equal(post.status, 200);
  assert.notDeepEqual(
    post.body.questions.map((q) => q.id),
    started.body.questions.map((q) => q.id),
  );
  const done = await student(`/assessments/${post.body.id}/submit`, 'POST', {
    responses: topic.post.map((q) => q.answer),
  });
  assert.equal(done.body.result.score, 100);
  assert.equal(done.body.comparison.gapsClosed, 3);
  const progress = (await student('/bootstrap')).body.progress;
  assert.equal(progress.xp, 200);
  assert.equal(progress.completed, 1);
  assert.equal(progress.gapsClosed, 3);
  assert.equal(
    (await student('/assessments', 'POST', { topicId: topic.id, mode: 'posttest' })).status,
    409,
  );
  const next = await student('/assessments', 'POST', { topicId: topic.id, mode: 'pretest' });
  assert.equal(next.status, 200);
  assert.notEqual(next.body.cycleId, post.body.cycleId);
  assert.equal((await student(`/assessments/${post.body.id}`)).body.comparison.gapsClosed, 3);
});

test('expired assessments grade persisted answers and cannot accept late answers', async () => {
  const request = client();
  await login(request, 'siswa@edubridge.id');
  const topic = initialTopics.find((t) => t.id === 'statistik');
  const started = await request('/assessments', 'POST', { topicId: topic.id, mode: 'pretest' });
  const partial = topic.pre.map((q, i) => (i === 0 ? q.answer : null));
  await request(`/assessments/${started.body.id}`, 'PATCH', { responses: partial });
  db.prepare('UPDATE assessments SET started_at=? WHERE id=?').run(
    new Date(Date.now() - 16 * 60_000).toISOString(),
    started.body.id,
  );
  assert.equal(
    (
      await request(`/assessments/${started.body.id}`, 'PATCH', {
        responses: topic.pre.map((q) => q.answer),
      })
    ).status,
    409,
  );
  const result = await request(`/assessments/${started.body.id}/submit`, 'POST', {
    responses: topic.pre.map((q) => q.answer),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.result.correctCount, 1);
  assert.deepEqual(result.body.responses, partial);
});

test('simultaneous submissions cannot duplicate XP or mutate completed answers', async () => {
  const request = client();
  await login(request, 'dimas@edubridge.id');
  const topic = initialTopics.find((t) => t.id === 'peluang');
  const started = await request('/assessments', 'POST', { topicId: topic.id, mode: 'pretest' });
  const responses = topic.pre.map((q) => q.answer);
  const result = await Promise.all(
    Array.from({ length: 4 }, () =>
      request(`/assessments/${started.body.id}/submit`, 'POST', { responses }),
    ),
  );
  assert.ok(result.every((r) => r.status === 200 && r.body.result.score === 100));
  assert.equal((await request('/bootstrap')).body.progress.xp, 60);
  assert.equal(
    (await request(`/assessments/${started.body.id}`, 'PATCH', { responses: Array(6).fill(0) }))
      .status,
    409,
  );
  assert.deepEqual((await request(`/assessments/${started.body.id}`)).body.responses, responses);
});

test('dummy diagnosis respects Q-matrix, unknown attributes, and negative changes', () => {
  const topic = initialTopics[0];
  const questions = topic.pre.slice(0, 2);
  const result = diagnose(
    topic,
    questions,
    questions.map((q) => q.answer),
  );
  assert.equal(result.attributes[1].mastery, null);
  assert.equal(result.gapCount, 0);
  const pre = diagnose(
    topic,
    topic.pre,
    topic.pre.map((q) => q.answer),
  );
  const post = diagnose(
    topic,
    topic.post,
    topic.post.map((q) => (q.answer + 1) % 4),
  );
  const comparison = compareDiagnoses(pre, post);
  assert.equal(comparison.scoreChange, -100);
  assert.equal(comparison.newGaps, 3);
  assert.equal(comparison.gapsClosed, 0);
});

test('teacher isolation, class creation, student details, and CSV export', async () => {
  const admin = client();
  await login(admin, 'admin@edubridge.id');
  const teacher = client();
  await login(teacher, 'guru@edubridge.id');
  const created = await admin('/admin/users', 'POST', {
    name: 'Guru Lain',
    email: 'lain@example.id',
    password: 'EduBridge123!',
    role: 'teacher',
  });
  assert.equal(created.status, 200);
  const other = client();
  await login(other, 'lain@example.id');
  assert.equal((await other('/classes/class-xi1')).status, 404);
  assert.equal((await other('/classes/class-xi1/export')).status, 404);
  assert.equal(
    (await other('/classes/class-xi1/phase', 'PATCH', { topicId: 'fungsi', phase: 'posttest' }))
      .status,
    404,
  );
  assert.equal((await other('/classes', 'POST', { name: 'X IPA 2' })).status, 400);
  const classroom = await other('/classes', 'POST', { name: 'XI IPA 2' });
  assert.equal(classroom.status, 200);
  assert.equal(classroom.body.classroom.teacher_id, created.body.user.id);
  const csv = await teacher('/classes/class-xi1/export');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.body, /Nadia Putri/);
  assert.match(csv.body, /Gap tertutup/);
  const details = await teacher('/classes/class-xi1');
  assert.ok(details.body.students.every((s) => !('password_hash' in s)));
});

test('admin content validation, publishing, account activation, and session invalidation', async () => {
  const admin = client();
  await login(admin, 'admin@edubridge.id');
  const student = client();
  await login(student, 'arya@edubridge.id');
  assert.equal((await admin('/admin/users/admin-demo', 'PATCH', { active: false })).status, 400);
  assert.equal((await admin('/admin/users/student-arya', 'PATCH', { active: false })).status, 200);
  assert.equal((await student('/auth/me')).status, 401);
  await admin('/admin/users/student-arya', 'PATCH', { active: true });
  await login(student, 'arya@edubridge.id');
  const topic = structuredClone(initialTopics.find((t) => t.id === 'transformasi'));
  const invalid = { ...topic, post: topic.post.map((q, i) => (i === 0 ? { ...q, answer: 8 } : q)) };
  assert.equal((await admin(`/admin/topics/${topic.id}`, 'PATCH', invalid)).status, 400);
  const saved = await admin(`/admin/topics/${topic.id}`, 'PATCH', {
    ...topic,
    title: 'Transformasi terbarui',
    published: false,
  });
  assert.equal(saved.status, 200);
  assert.equal(
    (await student('/bootstrap')).body.topics.some((t) => t.id === topic.id),
    false,
  );
  assert.equal(
    (await student('/assessments', 'POST', { topicId: topic.id, mode: 'pretest' })).status,
    400,
  );
  await admin(`/admin/topics/${topic.id}`, 'PATCH', topic);
});

test('password update revokes older sessions and profile data persists', async () => {
  const request = client();
  const old = client();
  await login(request, 'citra@edubridge.id');
  await login(old, 'citra@edubridge.id');
  const changed = await request('/profile', 'PATCH', {
    name: 'Citra Uji',
    school: 'SMA Pengujian',
    reminders: false,
  });
  assert.equal(changed.body.user.name, 'Citra Uji');
  assert.equal((await request('/bootstrap')).body.user.reminders, false);
  assert.equal(
    (await request('/profile/password', 'POST', { current: 'wrong123', password: 'Updated123!' }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/profile/password', 'POST', {
        current: 'EduBridge123!',
        password: 'Updated123!',
      })
    ).status,
    200,
  );
  assert.equal((await old('/auth/me')).status, 401);
  assert.equal((await request('/auth/me')).status, 200);
});
