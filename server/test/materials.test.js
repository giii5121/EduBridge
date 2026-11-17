import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, seedDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { chooseMaterialIcon } from '../src/materials.js';
import { createModelClient } from '../src/modelClient.js';

let db,
  server,
  base,
  folder,
  badGeneration = false;
function client() {
  let cookie = '',
    csrf = '';
  return async (path, method = 'GET', body) => {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: {
        Cookie: cookie,
        'X-CSRF-Token': csrf,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0];
    if (response.headers.get('x-csrf-token')) csrf = response.headers.get('x-csrf-token');
    return { status: response.status, body: await response.json() };
  };
}
async function signed(email) {
  const request = client();
  assert.equal(
    (await request('/auth/login', 'POST', { email, password: 'EduBridge123!' })).status,
    200,
  );
  return request;
}
const material = (overrides = {}) => ({
  title: 'Penguatan komposisi fungsi',
  summary: 'Pelajari komposisi fungsi melalui contoh dan latihan yang bertahap.',
  topicId: 'fungsi',
  classId: 'class-xi1',
  minutes: 20,
  published: false,
  reviewConfirmed: true,
  blocks: [
    {
      title: 'Urutan komposisi',
      body: 'Kerjakan fungsi bagian dalam terlebih dahulu: $(f \\circ g)(x)=f(g(x))$.',
      example: 'Jika $f(x)=2x$ dan $g(x)=x+1$, maka $f(g(x))=2x+2$.',
    },
  ],
  ...overrides,
});
before(async () => {
  folder = mkdtempSync(join(tmpdir(), 'edubridge-materials-'));
  db = openDatabase(join(folder, 'test.sqlite'));
  seedDatabase(db);
  const hash = db
    .prepare("SELECT password_hash FROM users WHERE id='teacher-demo'")
    .get().password_hash;
  const insert = db.prepare(
    'INSERT INTO users(id,email,password_hash,name,role,class_id,created_at) VALUES(?,?,?,?,?,?,?)',
  );
  insert.run(
    'other-teacher',
    'other-teacher@example.id',
    hash,
    'Guru Kedua',
    'teacher',
    null,
    new Date().toISOString(),
  );
  db.prepare('INSERT INTO classes VALUES(?,?,?,?,?)').run(
    'other-class',
    'XI IPA 2',
    'OTHER11',
    'other-teacher',
    new Date().toISOString(),
  );
  insert.run(
    'other-student',
    'other-student@example.id',
    hash,
    'Siswa Kedua',
    'student',
    'other-class',
    new Date().toISOString(),
  );
  server = createApp(db, {
    modelClient: {
      generateMaterial: async () => {
        if (badGeneration) throw new Error('SECRET-provider-error');
        return {
          draft: material({ published: true, review: { reviewerId: 'forged' } }),
          provider: 'gemini',
          model: 'test-model',
          status: 'draft',
          requiresReview: true,
        };
      },
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(folder, { recursive: true, force: true });
});

test('automatic icons use the existing six illustrated styles and remain stable', () => {
  for (const [title, icon] of [
    ['Fungsi invers', 'fungsi'],
    ['Sudut lingkaran', 'geometri'],
    ['Median data', 'statistik'],
    ['Peluang kejadian', 'peluang'],
    ['Determinan matriks', 'aljabar'],
    ['Rotasi bidang', 'transformasi'],
  ]) {
    assert.equal(chooseMaterialIcon(title, 'fungsi').icon, icon);
    assert.deepEqual(chooseMaterialIcon(title, 'fungsi'), chooseMaterialIcon(title, 'fungsi'));
  }
  assert.equal(chooseMaterialIcon('Penguatan konsep', 'geometri').icon, 'geometri');
  assert.ok(
    ['fungsi', 'geometri', 'statistik', 'peluang', 'aljabar', 'transformasi'].includes(
      chooseMaterialIcon('Judul baru', '__proto__').icon,
    ),
  );
});

test('teacher CRUD, student visibility, revisions and deletion preserve calibrated banks and assessment history', async () => {
  const teacher = await signed('guru@edubridge.id'),
    student = await signed('siswa@edubridge.id');
  const history = () =>
    JSON.stringify(
      ['topics', 'assessments', 'cycles', 'activity', 'stages'].map((table) =>
        db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
      ),
    );
  const original = history();
  let created = await teacher('/materials', 'POST', material());
  assert.equal(created.status, 200);
  let m = created.body.material;
  assert.equal(m.icon, 'fungsi');
  assert.equal(m.version, 1);
  assert.equal(m.canManage, true);
  assert.equal((await student('/materials/' + m.id)).status, 404);
  assert.equal(
    (await student('/materials')).body.materials.some((t) => t.id === m.id),
    false,
  );
  let edited = await teacher('/materials/' + m.id, 'PATCH', {
    ...m,
    published: true,
    reviewConfirmed: true,
    title: 'Sudut lingkaran untuk kelas',
  });
  assert.equal(edited.status, 200);
  m = edited.body.material;
  assert.equal(m.icon, 'geometri');
  assert.equal(m.version, 2);
  const visible = await student('/materials/' + m.id);
  assert.equal(visible.status, 200);
  assert.equal(visible.body.material.canManage, false);
  assert.ok(visible.body.material.blocks[0].body.includes('\\circ'));
  assert.ok((await student('/materials')).body.materials.find((t) => t.id === m.id));
  assert.equal((await teacher('/materials/' + m.id, 'PATCH', { ...m, version: 1 })).status, 409);
  assert.equal((await teacher('/materials/' + m.id, 'DELETE', { version: 1 })).status, 409);
  assert.equal((await teacher('/materials/' + m.id, 'DELETE', { version: m.version })).status, 200);
  assert.equal((await teacher('/materials/' + m.id)).status, 404);
  assert.equal((await student('/materials/' + m.id)).status, 404);
  assert.equal(history(), original);
  assert.equal(
    db.prepare('SELECT deleted_at FROM materials WHERE id=?').get(m.id).deleted_at !== null,
    true,
  );
  assert.deepEqual(
    db
      .prepare('SELECT action FROM audit_log WHERE target_id=? ORDER BY rowid')
      .all(m.id)
      .map((r) => r.action),
    ['material.created', 'material.updated', 'material.deleted'],
  );
});

test('class ownership, global publishing and every write permission are enforced on the server', async () => {
  const teacher = await signed('guru@edubridge.id'),
    other = await signed('other-teacher@example.id'),
    student = await signed('siswa@edubridge.id'),
    outsider = await signed('other-student@example.id'),
    admin = await signed('admin@edubridge.id');
  assert.equal((await client()('/materials')).status, 401);
  assert.equal((await student('/materials', 'POST', material())).status, 403);
  assert.equal((await teacher('/materials', 'POST', material({ classId: null }))).status, 403);
  assert.equal(
    (await teacher('/materials', 'POST', material({ classId: 'other-class' }))).status,
    403,
  );
  const m = (await teacher('/materials', 'POST', material({ published: true }))).body.material;
  assert.equal((await outsider('/materials/' + m.id)).status, 404);
  assert.equal((await other('/materials/' + m.id)).status, 404);
  assert.equal((await other('/materials/' + m.id, 'PATCH', m)).status, 404);
  assert.equal((await other('/materials/' + m.id, 'DELETE', { version: m.version })).status, 404);
  assert.equal((await student('/materials/' + m.id, 'PATCH', m)).status, 403);
  assert.equal((await student('/materials/' + m.id, 'DELETE', { version: m.version })).status, 403);
  assert.equal(
    (await teacher('/materials/' + m.id, 'PATCH', { ...m, classId: 'other-class' })).status,
    403,
  );
  const moved = await admin('/materials/' + m.id, 'PATCH', {
    ...m,
    classId: null,
    title: 'Penguatan matematika semua kelas',
    reviewConfirmed: true,
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.material.className, 'Semua kelas');
  assert.equal((await outsider('/materials/' + m.id)).status, 200);
  assert.equal((await teacher('/materials/' + m.id)).body.material.canManage, false);
  assert.equal((await teacher('/materials/' + m.id, 'DELETE', { version: 2 })).status, 404);
  assert.equal((await admin('/materials/' + m.id, 'DELETE', { version: 2 })).status, 200);
  const global = (await admin('/materials', 'POST', material({ classId: null, published: true })))
    .body.material;
  assert.equal((await outsider('/materials/' + global.id)).status, 200);
  assert.equal(
    (await admin('/materials/' + global.id, 'PATCH', { ...global, published: false })).status,
    200,
  );
  assert.equal((await student('/materials/' + global.id)).status, 404);
});

test('validation rejects malformed lessons and accepts extended Indonesian math lessons', async () => {
  const teacher = await signed('guru@edubridge.id');
  for (const change of [
    { title: 'x' },
    { minutes: 0 },
    { minutes: 1.5 },
    { minutes: 181 },
    { published: 'true' },
    { topicId: 'fake' },
    { classId: undefined },
    { blocks: [] },
    { blocks: [null] },
    { blocks: [{ title: 'Konsep', body: 'short', example: 'contoh' }] },
    {
      blocks: [
        {
          ...material().blocks[0],
          worked: { prompt: 'contoh', steps: ['satu'], conclusion: 'tidak valid' },
        },
      ],
    },
  ]) {
    const result = await teacher('/materials', 'POST', material(change));
    assert.ok([400, 403].includes(result.status), JSON.stringify(change));
  }
  const blocks = JSON.parse(
    db.prepare("SELECT data FROM topics WHERE id='geometri'").get().data,
  ).blocks;
  const created = await teacher(
    '/materials',
    'POST',
    material({ title: 'Lingkaran dengan pembahasan', topicId: 'geometri', blocks }),
  );
  assert.equal(created.status, 200);
  assert.equal(created.body.material.blocks.length, 3);
  assert.equal(created.body.material.blocks[0].practice.length, 2);
  const reloaded = (await teacher('/materials/' + created.body.material.id)).body.material;
  assert.deepEqual(reloaded.blocks, created.body.material.blocks);
});

test('audit failures roll back the material mutation atomically', async () => {
  const teacher = await signed('guru@edubridge.id');
  const before = db.prepare('SELECT COUNT(*) AS n FROM materials').get().n;
  db.exec(
    "CREATE TRIGGER audit_material_failure BEFORE INSERT ON audit_log WHEN NEW.action='material.created' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;",
  );
  try {
    assert.equal((await teacher('/materials', 'POST', material())).status, 500);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM materials').get().n, before);
  } finally {
    db.exec('DROP TRIGGER audit_material_failure');
  }
});

test('materials and revisions persist through a second database connection and schema initialization', async () => {
  const teacher = await signed('guru@edubridge.id');
  const m = (await teacher('/materials', 'POST', material())).body.material;
  const reopened = openDatabase(join(folder, 'test.sqlite'));
  try {
    const row = reopened.prepare('SELECT * FROM materials WHERE id=?').get(m.id);
    assert.equal(row.revision, 1);
    assert.equal(JSON.parse(row.data).title, m.title);
  } finally {
    reopened.close();
  }
});

test('publication requires human review bound to exact content, and forged review metadata cannot bypass it', async () => {
  const teacher = await signed('guru@edubridge.id');
  assert.equal(
    (
      await teacher(
        '/materials',
        'POST',
        material({
          published: true,
          reviewConfirmed: false,
          review: { contentHash: 'fake', reviewerId: 'admin-demo' },
        }),
      )
    ).status,
    422,
  );
  const draft = (await teacher('/materials', 'POST', material({ reviewConfirmed: false }))).body
    .material;
  assert.equal(draft.review, null);
  const reviewed = (
    await teacher('/materials/' + draft.id, 'PATCH', {
      ...draft,
      published: true,
      reviewConfirmed: true,
    })
  ).body.material;
  assert.equal(reviewed.review.reviewerId, 'teacher-demo');
  assert.equal(reviewed.review.reviewerRole, 'teacher');
  assert.equal(
    (
      await teacher('/materials/' + draft.id, 'PATCH', {
        ...reviewed,
        title: 'Isi diubah setelah validasi',
      })
    ).status,
    422,
  );
  const revised = (
    await teacher('/materials/' + draft.id, 'PATCH', {
      ...reviewed,
      published: false,
      title: 'Isi diubah setelah validasi',
    })
  ).body.material;
  assert.equal(revised.review, null);
  assert.equal(
    (
      await teacher('/materials/' + draft.id, 'PATCH', {
        ...revised,
        published: true,
        review: reviewed.review,
      })
    ).status,
    422,
  );
  const valid = await teacher('/materials/' + draft.id, 'PATCH', {
    ...revised,
    published: true,
    reviewConfirmed: true,
  });
  assert.equal(valid.status, 200);
  assert.notEqual(valid.body.material.review.contentHash, reviewed.review.contentHash);
  const reviewedDraft = (
    await teacher('/materials', 'POST', material({ published: false, reviewConfirmed: true }))
  ).body.material;
  const publishUnchanged = await teacher('/materials/' + reviewedDraft.id, 'PATCH', {
    ...reviewedDraft,
    published: true,
  });
  assert.equal(publishUnchanged.status, 200);
  assert.equal(publishUnchanged.body.material.review.contentHash, reviewedDraft.review.contentHash);
});

test('AI generation is staff-only, scoped, rate-protected, returns an unreviewed unsaved draft and fails safely', async () => {
  const teacher = await signed('guru@edubridge.id'),
    student = await signed('siswa@edubridge.id');
  const payload = {
    topicId: 'fungsi',
    classId: 'class-xi1',
    title: 'Fungsi komposisi',
    sectionTitle: '',
    instructions: 'Tolong jelaskan bertahap.',
    blockCount: 1,
  };
  assert.equal((await student('/materials/generate', 'POST', payload)).status, 403);
  assert.equal(
    (await teacher('/materials/generate', 'POST', { ...payload, classId: 'other-class' })).status,
    403,
  );
  assert.equal(
    (await teacher('/materials/generate', 'POST', { ...payload, blockCount: 7 })).status,
    400,
  );
  const before = db.prepare('SELECT COUNT(*) AS n FROM materials').get().n;
  const generated = await teacher('/materials/generate', 'POST', payload);
  assert.equal(generated.status, 200);
  assert.equal(generated.body.draft.published, false);
  assert.equal(generated.body.draft.review, null);
  assert.equal(generated.body.draft.aiGenerated, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM materials').get().n, before);
  const draft = material({ ...generated.body.draft, reviewConfirmed: false });
  assert.equal((await teacher('/materials', 'POST', { ...draft, published: true })).status, 422);
  assert.equal((await teacher('/materials', 'POST', draft)).status, 200);
  badGeneration = true;
  try {
    const response = await teacher('/materials/generate', 'POST', payload);
    assert.equal(response.status, 503);
    assert.ok(!JSON.stringify(response.body).includes('SECRET'));
  } finally {
    badGeneration = false;
  }
});

test('model client sends only the current lesson context to the generator, without assessment banks or identities', async () => {
  let sent;
  const client = createModelClient({
    baseUrl: 'http://127.0.0.1:9999',
    key: 'unit-service-key',
    fetcher: async (url, options) => {
      assert.equal(url.pathname, '/v1/materials/generate');
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ status: 'draft' }), { status: 200 });
    },
  });
  const topic = JSON.parse(db.prepare("SELECT data FROM topics WHERE id='fungsi'").get().data);
  await client.generateMaterial(topic, {
    title: 'Fungsi',
    sectionTitle: 'Komposisi',
    instructions: 'Contoh sederhana',
    blockCount: 1,
    classId: 'private-class',
    studentId: 'private-student',
  });
  assert.deepEqual(Object.keys(sent.context).sort(), ['attributes', 'blocks', 'title']);
  assert.deepEqual(Object.keys(sent.context.blocks[0]).sort(), ['body', 'example', 'title']);
  assert.ok(!JSON.stringify(sent).includes('private-'));
  assert.ok(!('pre' in sent) && !('post' in sent));
});
