import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, hashPasswordAsync, verifyPasswordAsync } from './database.js';
import { compareDiagnoses } from './diagnosis.js';
import { createModelClient } from './modelClient.js';
import { validLesson, normalizeLesson } from './lessonSchema.js';
import {
  publicUser,
  catalog,
  progress,
  allTopics,
  getTopic,
  latestCycle,
  resultFor,
  learningState,
  classroomData,
} from './domain.js';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (condition, status, message) => {
  if (condition) throw new HttpError(status, message);
};
const clean = (value, min = 1, max = 150) =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const validEmail = (value) =>
  typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPassword = (value) =>
  typeof value === 'string' && value.length >= 8 && value.length <= 128;
const tokenHash = (value) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const modes = ['pretest', 'posttest', 'remedial'];
const safeQuestions = (questions) => questions.map(({ answer, explanation, ...q }) => q);

async function readBody(req) {
  fail(
    !req.headers['content-type']?.startsWith('application/json'),
    415,
    'Gunakan Content-Type application/json.',
  );
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    fail(Buffer.byteLength(raw) > 100_000, 413, 'Data terlalu besar.');
  }
  try {
    const body = JSON.parse(raw || '{}');
    fail(
      !body || Array.isArray(body) || typeof body !== 'object',
      400,
      'Data harus berupa objek JSON.',
    );
    return body;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Format JSON tidak valid.');
  }
}
function validateResponses(responses, questions, complete = false) {
  fail(
    !Array.isArray(responses) || responses.length !== questions.length,
    400,
    'Jumlah jawaban tidak sesuai dengan soal.',
  );
  fail(
    responses.some(
      (answer, i) =>
        answer !== null &&
        (!Number.isInteger(answer) || answer < 0 || answer >= questions[i].options.length),
    ),
    400,
    'Pilihan jawaban tidak valid.',
  );
  fail(
    complete && responses.some((answer) => answer === null),
    400,
    'Jawab semua soal sebelum mengumpulkan asesmen.',
  );
}
function assessmentView(db, row) {
  const topic = getTopic(db, row.topic_id);
  const questions = JSON.parse(row.questions);
  return {
    id: row.id,
    topicId: row.topic_id,
    title: topic.title,
    mode: row.mode,
    cycleId: row.cycle_id,
    questions: row.completed_at ? questions : safeQuestions(questions),
    responses: row.responses ? JSON.parse(row.responses) : questions.map(() => null),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    deadline: new Date(Date.parse(row.started_at) + 15 * 60_000).toISOString(),
    remainingSeconds: Math.max(0, (Date.parse(row.started_at) + 15 * 60_000 - Date.now()) / 1000),
    result: row.diagnosis ? JSON.parse(row.diagnosis) : null,
    xp: row.xp,
    comparison:
      row.completed_at && row.mode === 'posttest'
        ? compareDiagnoses(
            resultFor(db, row.cycle_id, 'pretest'),
            resultFor(db, row.cycle_id, 'posttest'),
          )
        : null,
  };
}

export function createApp(
  db,
  {
    staticDir = fileURLToPath(new URL('../../client/dist', import.meta.url)),
    production = process.env.NODE_ENV === 'production',
    modelClient = createModelClient(),
  } = {},
) {
  const loginAttempts = new Map();
  const addressFor = (req) =>
    process.env.TRUST_PROXY === 'true' && typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',').at(-1).trim().slice(0, 80)
      : req.socket.remoteAddress;
  const csrfFor = (token) => createHmac('sha256', token).update('edubridge:csrf:v1').digest('hex');
  const requestAttempts = new Map();
  const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'));
  const aiAttempts = new Map();
  const audit = (actor, action, target) =>
    db
      .prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)')
      .run(randomUUID(), actor, action, target, now());
  const aiLimit = (user) => {
    const key = user.id;
    const entry = aiAttempts.get(key);
    fail(
      entry?.until > Date.now() && entry.count >= 20,
      429,
      'Batas permintaan pendamping tercapai. Coba lagi dalam beberapa menit.',
    );
    aiAttempts.set(key, {
      count: entry?.until > Date.now() ? entry.count + 1 : 1,
      until: entry?.until > Date.now() ? entry.until : Date.now() + 600000,
    });
    if (aiAttempts.size > 10000)
      for (const [id, value] of aiAttempts) if (value.until < Date.now()) aiAttempts.delete(id);
  };
  const routes = [];
  const route = (method, pattern, roles, handler) =>
    routes.push({ method, pattern: new RegExp(`^${pattern}$`), roles, handler });
  const addSession = (res, user, remember) => {
    const token = randomBytes(32).toString('hex');
    const seconds = remember ? 30 * 86400 : 86400;
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
      tokenHash(token),
      user.id,
      new Date(Date.now() + seconds * 1000).toISOString(),
    );
    // Bound active sessions and evict older tokens without retaining the raw token.
    db.prepare(
      'DELETE FROM sessions WHERE user_id=? AND id NOT IN (SELECT id FROM sessions WHERE user_id=? ORDER BY expires_at DESC,rowid DESC LIMIT 10)',
    ).run(user.id, user.id);
    res.setHeader(
      'Set-Cookie',
      `edubridge_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${production ? '; Secure' : ''}`,
    );
    res.setHeader('X-CSRF-Token', csrfFor(token));
  };

  route('GET', '/api/health', null, () => ({ status: 'ok', diagnosis: 'pdina' }));
  route('GET', '/api/ready', null, async () => {
    await modelClient.status();
    return { status: 'ready', database: Boolean(db.prepare('SELECT 1').get()), diagnosis: 'pdina' };
  });
  route('GET', '/api/config', null, () => ({
    demoEnabled:
      process.env.SEED_DEMO === 'true' || (!production && process.env.SEED_DEMO !== 'false'),
  }));
  route('POST', '/api/auth/login', null, async ({ req, res }) => {
    const body = await readBody(req);
    fail(
      !validEmail(body.email) || !validPassword(body.password),
      400,
      'Masukkan email dan kata sandi minimal 8 karakter.',
    );
    const key = `${addressFor(req)}:${body.email.trim().toLowerCase()}`;
    const limit = loginAttempts.get(key);
    fail(
      limit?.count >= 10 && limit.until > Date.now(),
      429,
      'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
    );
    const user = db
      .prepare('SELECT * FROM users WHERE email=?')
      .get(body.email.trim().toLowerCase());
    const passwordValid = await verifyPasswordAsync(
      body.password,
      user?.password_hash ?? dummyPasswordHash,
    );
    if (!user || !passwordValid || !user.active) {
      if (loginAttempts.size > 10000) {
        for (const [k, v] of loginAttempts) if (v.until < Date.now()) loginAttempts.delete(k);
      }
      loginAttempts.set(key, {
        count: limit?.until > Date.now() ? limit.count + 1 : 1,
        until: Date.now() + 900_000,
      });
      throw new HttpError(401, 'Email atau kata sandi salah, atau akun dinonaktifkan.');
    }
    loginAttempts.delete(key);
    if (!user.password_hash.startsWith('scrypt$65536$8$2$')) {
      const upgraded = await hashPasswordAsync(body.password);
      fail(
        !db
          .prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=? AND active=1')
          .run(upgraded, user.id, user.password_hash).changes,
        401,
        'Kredensial berubah. Silakan masuk kembali.',
      );
    } else {
      const current = db.prepare('SELECT active,password_hash FROM users WHERE id=?').get(user.id);
      fail(
        !current?.active || current.password_hash !== user.password_hash,
        401,
        'Kredensial berubah. Silakan masuk kembali.',
      );
    }
    const oldToken = req.headers.cookie?.match(/(?:^|; )edubridge_session=([^;]+)/)?.[1];
    if (oldToken) db.prepare('DELETE FROM sessions WHERE id=?').run(tokenHash(oldToken));
    addSession(res, user, body.remember);
    return { user: publicUser(user) };
  });
  route('POST', '/api/auth/register', null, async ({ req, res }) => {
    const body = await readBody(req);
    fail(
      !clean(body.name, 2, 80) || !validEmail(body.email) || !validPassword(body.password),
      400,
      'Isi nama, email valid, dan kata sandi 8–128 karakter.',
    );
    fail(!clean(body.classCode, 4, 20), 400, 'Masukkan kode kelas dari gurumu.');
    fail(body.agree !== true, 400, 'Persetujuan penggunaan diperlukan untuk mendaftar.');
    const classroom = db.prepare('SELECT * FROM classes WHERE code=?').get(body.classCode.trim());
    fail(!classroom, 400, 'Kode kelas tidak ditemukan. Tanyakan kode yang benar kepada guru.');
    const email = body.email.trim().toLowerCase();
    fail(
      db.prepare('SELECT id FROM users WHERE email=?').get(email),
      409,
      'Email sudah terdaftar. Silakan masuk.',
    );
    const id = randomUUID();
    db.prepare(
      'INSERT INTO users(id,email,password_hash,name,role,class_id,school,created_at) VALUES(?,?,?,?,?,?,?,?)',
    ).run(
      id,
      email,
      await hashPasswordAsync(body.password),
      body.name.trim(),
      'student',
      classroom.id,
      clean(body.school, 2, 120) ? body.school.trim() : 'SMA EduBridge',
      now(),
    );
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    addSession(res, user, false);
    return { user: publicUser(user) };
  });
  route('POST', '/api/auth/logout', [], ({ req, res }) => {
    const token = req.headers.cookie?.match(/(?:^|; )edubridge_session=([^;]+)/)?.[1];
    if (token) db.prepare('DELETE FROM sessions WHERE id=?').run(tokenHash(token));
    res.setHeader(
      'Set-Cookie',
      `edubridge_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${production ? '; Secure' : ''}`,
    );
    return { ok: true };
  });
  route('GET', '/api/auth/me', [], ({ user }) => ({ user: publicUser(user) }));
  route('GET', '/api/bootstrap', [], ({ user }) => {
    const classroom = user.class_id
      ? db.prepare('SELECT id,name,code FROM classes WHERE id=?').get(user.class_id)
      : null;
    return {
      user: publicUser(user),
      classroom,
      topics: catalog(db, user),
      progress: progress(db, user),
    };
  });
  route('PATCH', '/api/profile', [], async ({ req, user }) => {
    const body = await readBody(req);
    fail(
      !clean(body.name, 2, 80) || !clean(body.school, 2, 120),
      400,
      'Nama dan sekolah harus terisi.',
    );
    fail(typeof body.reminders !== 'boolean', 400, 'Preferensi pengingat tidak valid.');
    db.prepare('UPDATE users SET name=?,school=?,reminders=? WHERE id=?').run(
      body.name.trim(),
      body.school.trim(),
      Number(body.reminders),
      user.id,
    );
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) };
  });
  route('POST', '/api/profile/password', [], async ({ req, user, res }) => {
    const body = await readBody(req);
    fail(
      typeof body.current !== 'string' || !validPassword(body.password),
      400,
      'Kata sandi baru harus 8–128 karakter.',
    );
    fail(
      !(await verifyPasswordAsync(body.current, user.password_hash)),
      400,
      'Kata sandi saat ini tidak sesuai.',
    );
    const nextHash = await hashPasswordAsync(body.password);
    fail(
      !db
        .prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=? AND active=1')
        .run(nextHash, user.id, user.password_hash).changes,
      409,
      'Kredensial berubah. Silakan masuk kembali.',
    );
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    addSession(res, user, false);
    return { ok: true };
  });

  route('POST', '/api/assessments', ['student'], async ({ req, user }) => {
    const body = await readBody(req);
    const topic = getTopic(db, body.topicId);
    fail(
      !topic?.published || !modes.includes(body.mode),
      400,
      'Topik atau jenis asesmen tidak tersedia.',
    );
    let cycle = latestCycle(db, user.id, topic.id);
    const state = learningState(db, user, topic);
    if (body.mode === 'pretest') {
      fail(
        state.pre && !state.post,
        409,
        'Selesaikan siklus belajar yang sedang berjalan sebelum mengulang pretest.',
      );
      if (!cycle || state.post) {
        const id = randomUUID();
        db.prepare('INSERT INTO cycles VALUES(?,?,?,NULL,?)').run(id, user.id, topic.id, now());
        cycle = latestCycle(db, user.id, topic.id);
      }
    } else {
      fail(!state.pre, 409, 'Selesaikan pretest topik ini terlebih dahulu.');
      if (body.mode === 'posttest') {
        fail(
          state.post,
          409,
          'Posttest siklus ini sudah selesai. Mulai siklus baru dari pretest untuk mengulang.',
        );
        fail(
          !cycle.lesson_at,
          409,
          'Selesaikan materi penguatan setelah pembelajaran kelas sebelum posttest.',
        );
        fail(state.phase !== 'posttest', 409, 'Posttest belum dibuka oleh guru.');
      }
      fail(
        body.mode === 'remedial' && state.phase === 'pretest',
        409,
        'Tunggu guru membuka fase pembelajaran.',
      );
    }
    const pending = db
      .prepare(
        'SELECT * FROM assessments WHERE cycle_id=? AND mode=? AND completed_at IS NULL ORDER BY rowid DESC LIMIT 1',
      )
      .get(cycle.id, body.mode);
    if (pending) return assessmentView(db, pending);
    const id = randomUUID();
    let questions = body.mode === 'posttest' ? topic.post : topic.pre;
    if (body.mode === 'remedial') {
      const latest = state.post ?? state.pre;
      const gapIds = latest.attributes.filter((a) => a.status !== 'mastered').map((a) => a.id);
      const subset = topic.post.filter((q) => q.attributes.some((a) => gapIds.includes(a)));
      questions = subset.length ? subset : topic.post;
    }
    db.prepare(
      'INSERT INTO assessments(id,cycle_id,user_id,topic_id,mode,questions,started_at) VALUES(?,?,?,?,?,?,?)',
    ).run(id, cycle.id, user.id, topic.id, body.mode, JSON.stringify(questions), now());
    return assessmentView(db, db.prepare('SELECT * FROM assessments WHERE id=?').get(id));
  });
  const ownedAssessment = (id, user) => {
    const row = db.prepare('SELECT * FROM assessments WHERE id=? AND user_id=?').get(id, user.id);
    fail(!row, 404, 'Asesmen tidak ditemukan.');
    return row;
  };
  route('GET', '/api/assessments/([^/]+)', ['student'], ({ params, user }) =>
    assessmentView(db, ownedAssessment(params[0], user)),
  );
  route('PATCH', '/api/assessments/([^/]+)', ['student'], async ({ params, user, req }) => {
    const body = await readBody(req);
    const row = ownedAssessment(params[0], user);
    fail(row.completed_at, 409, 'Asesmen sudah dikumpulkan.');
    fail(
      Date.now() > Date.parse(row.started_at) + 15 * 60_000,
      409,
      'Waktu asesmen habis. Kumpulkan jawaban terakhir.',
    );
    validateResponses(body.responses, JSON.parse(row.questions));
    db.prepare('UPDATE assessments SET responses=? WHERE id=?').run(
      JSON.stringify(body.responses),
      row.id,
    );
    return { ok: true };
  });
  route('POST', '/api/assessments/([^/]+)/submit', ['student'], async ({ params, user, req }) => {
    const body = await readBody(req);
    const row = ownedAssessment(params[0], user);
    if (row.completed_at) return assessmentView(db, row);
    const questions = JSON.parse(row.questions);
    const expired = Date.now() > Date.parse(row.started_at) + 15 * 60_000;
    const responses = expired
      ? row.responses
        ? JSON.parse(row.responses)
        : questions.map(() => null)
      : body.responses;
    validateResponses(responses, questions, !expired);
    const topic = getTopic(db, row.topic_id);
    db.prepare('UPDATE assessments SET responses=? WHERE id=? AND completed_at IS NULL').run(
      JSON.stringify(responses),
      row.id,
    );
    const result = await modelClient.diagnose(topic, questions, responses, user.id);
    const existing = db.prepare('SELECT * FROM assessments WHERE id=?').get(row.id);
    if (existing.completed_at) return assessmentView(db, existing);
    const currentToken = req.headers.cookie?.match(/(?:^|; )edubridge_session=([^;]+)/)?.[1];
    fail(
      !currentToken ||
        !db
          .prepare(
            'SELECT s.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>? AND u.active=1',
          )
          .get(tokenHash(currentToken), now()),
      401,
      'Sesi berakhir. Silakan masuk kembali.',
    );
    const hadPractice = Boolean(resultFor(db, row.cycle_id, 'remedial'));
    const xp = row.mode === 'pretest' ? 60 : row.mode === 'posttest' ? 100 : hadPractice ? 0 : 20;
    const completedAt = now();
    db.exec('BEGIN');
    try {
      db.prepare(
        'UPDATE assessments SET responses=?,diagnosis=?,xp=?,completed_at=? WHERE id=?',
      ).run(JSON.stringify(responses), JSON.stringify(result), xp, completedAt, row.id);
      db.prepare('INSERT INTO activity VALUES(?,?,?,?,?,?)').run(
        randomUUID(),
        user.id,
        row.mode,
        topic.id,
        xp,
        completedAt,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return assessmentView(db, db.prepare('SELECT * FROM assessments WHERE id=?').get(row.id));
  });
  route('POST', '/api/topics/([^/]+)/lesson', ['student'], ({ params, user }) => {
    const topic = getTopic(db, params[0]);
    fail(!topic?.published, 404, 'Materi tidak tersedia.');
    const state = learningState(db, user, topic);
    fail(
      !state.pre,
      409,
      'Selesaikan pretest dahulu agar rekomendasi penguatan sesuai kebutuhanmu.',
    );
    fail(state.phase === 'pretest', 409, 'Tunggu guru membuka fase pembelajaran di kelas.');
    if (!state.lessonAt) {
      db.exec('BEGIN');
      try {
        db.prepare('UPDATE cycles SET lesson_at=? WHERE id=?').run(now(), state.cycleId);
        db.prepare('INSERT INTO activity VALUES(?,?,?,?,?,?)').run(
          randomUUID(),
          user.id,
          'lesson',
          topic.id,
          40,
          now(),
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    return { state: learningState(db, user, topic) };
  });
  route('POST', '/api/assistant', ['student'], async ({ req, user }) => {
    const body = await readBody(req);
    const topic = getTopic(db, body.topicId);
    fail(
      !topic?.published || !clean(body.message, 1, 1000),
      400,
      'Pilih topik dan tuliskan pertanyaanmu.',
    );
    const state = learningState(db, user, topic);
    const active = db
      .prepare('SELECT id FROM assessments WHERE user_id=? AND completed_at IS NULL LIMIT 1')
      .get(user.id);
    fail(active, 409, 'Pendamping belajar tersedia setelah asesmen dikumpulkan.');
    fail(!state.pre, 409, 'Selesaikan pretest terlebih dahulu.');
    fail(
      !Array.isArray(body.history ?? []) ||
        (body.history?.length ?? 0) > 6 ||
        (body.history ?? []).some(
          (h) => !['user', 'assistant'].includes(h.role) || !clean(h.text, 1, 2000),
        ),
      400,
      'Riwayat percakapan tidak valid.',
    );
    aiLimit(user);
    return modelClient.tutor(topic, body.message.trim(), body.history ?? []).catch(() => {
      const blockIndex = state.pre.recommendations[0]?.blockIndex ?? 0;
      const block = topic.blocks[blockIndex];
      return {
        provider: 'lesson-content',
        fallback: true,
        simulated: false,
        blockIndex,
        reason: 'inference_unavailable',
        message: `${block.title}\n\n${block.body}\n\nContoh: ${block.example}`,
      };
    });
  });
  route('POST', '/api/assessments/([^/]+)/narrative', ['student'], async ({ params, user }) => {
    const row = ownedAssessment(params[0], user);
    fail(!row.completed_at, 409, 'Kumpulkan asesmen sebelum membuat ringkasan.');
    const result = JSON.parse(row.diagnosis);
    fail(
      result.provider !== 'pdina',
      409,
      'Hasil ini berasal dari diagnosis lama. Gunakan asesmen baru untuk ringkasan PDINA.',
    );
    aiLimit(user);
    return modelClient.narrative(
      getTopic(db, row.topic_id),
      JSON.parse(row.questions),
      JSON.parse(row.responses),
      user.id,
      'student',
      result.version,
    );
  });

  route('GET', '/api/classes', ['teacher', 'admin'], ({ user }) => {
    const classes =
      user.role === 'admin'
        ? db.prepare('SELECT * FROM classes ORDER BY name').all()
        : db.prepare('SELECT * FROM classes WHERE teacher_id=? ORDER BY name').all(user.id);
    return {
      classes: classes.map((c) => ({
        ...c,
        studentCount: db
          .prepare(
            "SELECT COUNT(*) AS n FROM users WHERE class_id=? AND role='student' AND active=1",
          )
          .get(c.id).n,
      })),
    };
  });
  route('POST', '/api/classes', ['teacher', 'admin'], async ({ req, user }) => {
    const body = await readBody(req);
    fail(
      !clean(body.name, 4, 50) || !/^XI(?:\s|$)/i.test(body.name.trim()),
      400,
      'Nama kelas harus dimulai dengan XI, misalnya XI IPA 2.',
    );
    const teacherId = user.role === 'admin' ? body.teacherId : user.id;
    fail(!clean(teacherId, 1, 80), 400, 'Pilih guru aktif sebagai penanggung jawab.');
    fail(
      !db
        .prepare("SELECT id FROM users WHERE id=? AND role='teacher' AND active=1")
        .get(teacherId ?? ''),
      400,
      'Pilih guru aktif sebagai penanggung jawab.',
    );
    const id = randomUUID();
    const code = `XI${randomBytes(4).toString('hex').toUpperCase()}`;
    db.prepare('INSERT INTO classes VALUES(?,?,?,?,?)').run(
      id,
      body.name.trim(),
      code,
      teacherId,
      now(),
    );
    return { classroom: db.prepare('SELECT * FROM classes WHERE id=?').get(id) };
  });
  route('GET', '/api/classes/([^/]+)', ['teacher', 'admin'], ({ params, user }) => {
    const data = classroomData(db, user, params[0]);
    fail(!data, 404, 'Kelas tidak ditemukan atau tidak berada dalam pengelolaan Anda.');
    return data;
  });
  route(
    'POST',
    '/api/classes/([^/]+)/narrative',
    ['teacher', 'admin'],
    async ({ params, req, user }) => {
      fail(!classroomData(db, user, params[0]), 404, 'Kelas tidak ditemukan.');
      const body = await readBody(req);
      const topic = getTopic(db, body.topicId);
      fail(
        !topic?.published || !['pretest', 'posttest'].includes(body.mode),
        400,
        'Pilih topik dan fase asesmen.',
      );
      const rows = db
        .prepare(
          "SELECT a.* FROM assessments a JOIN users u ON u.id=a.user_id WHERE u.class_id=? AND u.role='student' AND u.active=1 AND a.topic_id=? AND a.mode=? AND a.completed_at IS NOT NULL AND a.cycle_id=(SELECT c.id FROM cycles c WHERE c.user_id=u.id AND c.topic_id=a.topic_id ORDER BY c.created_at DESC,c.rowid DESC LIMIT 1) ORDER BY a.completed_at DESC,a.rowid DESC",
        )
        .all(params[0], topic.id, body.mode);
      const seen = new Set();
      const records = rows.filter((row) => {
        if (seen.has(row.user_id)) return false;
        seen.add(row.user_id);
        return JSON.parse(row.diagnosis).provider === 'pdina';
      });
      fail(
        !records.length,
        409,
        'Belum ada hasil PDINA pada fase ini. Hasil simulasi lama tidak disertakan.',
      );
      fail(
        new Set(records.map((row) => JSON.parse(row.diagnosis).version)).size > 1,
        409,
        'Ringkasan kelas memerlukan versi model yang sama. Tinjau riwayat model bersama administrator.',
      );
      fail(records.length > 60, 400, 'Ringkasan mendukung hingga 60 siswa per kelas.');
      aiLimit(user);
      return modelClient.classNarrative(topic, records);
    },
  );
  route(
    'PATCH',
    '/api/classes/([^/]+)/phase',
    ['teacher', 'admin'],
    async ({ req, user, params }) => {
      fail(!classroomData(db, user, params[0]), 404, 'Kelas tidak ditemukan.');
      const body = await readBody(req);
      fail(
        !getTopic(db, body.topicId) || !['pretest', 'learning', 'posttest'].includes(body.phase),
        400,
        'Topik atau fase tidak valid.',
      );
      db.prepare(
        'INSERT INTO stages VALUES(?,?,?) ON CONFLICT(class_id,topic_id) DO UPDATE SET phase=excluded.phase',
      ).run(params[0], body.topicId, body.phase);
      return { ok: true };
    },
  );
  route('GET', '/api/classes/([^/]+)/export', ['teacher', 'admin'], ({ params, user, res }) => {
    const data = classroomData(db, user, params[0]);
    fail(!data, 404, 'Kelas tidak ditemukan.');
    const quote = (value) =>
      `"${String(value ?? '')
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      ['Nama', 'Email', 'Topik', 'Pretest', 'Posttest', 'Gap awal', 'Gap akhir', 'Gap tertutup'],
    ];
    for (const student of data.students)
      for (const topic of student.topics)
        rows.push([
          student.name,
          student.email,
          topic.title,
          topic.state.pre?.score,
          topic.state.post?.score,
          topic.state.pre?.gapCount,
          topic.state.post?.gapCount,
          topic.state.comparison?.gapsClosed,
        ]);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="edubridge-kelas-${data.code}.csv"`,
    });
    res.end('\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n'));
    return undefined;
  });

  route('GET', '/api/admin/overview', ['admin'], async () => ({
    users: db.prepare('SELECT * FROM users ORDER BY created_at DESC, name').all().map(publicUser),
    topics: allTopics(db),
    classes: db
      .prepare(
        'SELECT c.*,u.name AS teacher_name FROM classes c JOIN users u ON u.id=c.teacher_id ORDER BY c.name',
      )
      .all(),
    assessments: db
      .prepare('SELECT COUNT(*) AS n FROM assessments WHERE completed_at IS NOT NULL')
      .get().n,
    diagnosis: await modelClient
      .status()
      .catch(() => ({ ready: false, provider: 'pdina', simulated: false, models: [] })),
    gemini: {
      configured: process.env.LLM_ENABLED !== 'false' && Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    },
    audit: db
      .prepare(
        'SELECT action,target_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT 30',
      )
      .all(),
  }));
  route('POST', '/api/admin/users', ['admin'], async ({ req, user: actor }) => {
    const body = await readBody(req);
    fail(
      !clean(body.name, 2, 80) ||
        !validEmail(body.email) ||
        !validPassword(body.password) ||
        !['student', 'teacher', 'admin'].includes(body.role),
      400,
      'Isi data akun dengan benar. Kata sandi minimal 8 karakter.',
    );
    fail(
      db.prepare('SELECT id FROM users WHERE email=?').get(body.email.trim()),
      409,
      'Email sudah digunakan.',
    );
    fail(
      body.role === 'student' &&
        (!clean(body.classId, 1, 80) ||
          !db.prepare('SELECT id FROM classes WHERE id=?').get(body.classId)),
      400,
      'Pilih kelas untuk siswa.',
    );
    const id = randomUUID();
    db.prepare(
      'INSERT INTO users(id,email,password_hash,name,role,class_id,created_at) VALUES(?,?,?,?,?,?,?)',
    ).run(
      id,
      body.email.trim().toLowerCase(),
      await hashPasswordAsync(body.password),
      body.name.trim(),
      body.role,
      body.role === 'student' ? body.classId : null,
      now(),
    );
    audit(actor.id, 'user.created', id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)) };
  });
  route('PATCH', '/api/admin/users/([^/]+)', ['admin'], async ({ req, user, params }) => {
    const body = await readBody(req);
    const target = db.prepare('SELECT * FROM users WHERE id=?').get(params[0]);
    fail(!target, 404, 'Akun tidak ditemukan.');
    fail(typeof body.active !== 'boolean', 400, 'Status akun tidak valid.');
    fail(
      target.id === user.id && !body.active,
      400,
      'Akun admin yang sedang digunakan tidak dapat dinonaktifkan.',
    );
    db.prepare('UPDATE users SET active=? WHERE id=?').run(Number(body.active), target.id);
    if (!body.active) db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
    audit(user.id, body.active ? 'user.activated' : 'user.deactivated', target.id);
    return { ok: true };
  });
  route('PATCH', '/api/admin/topics/([^/]+)', ['admin'], async ({ req, params, user }) => {
    const body = await readBody(req);
    const topic = getTopic(db, params[0]);
    fail(!topic, 404, 'Topik tidak ditemukan.');
    fail(
      !clean(body.title, 3, 100) ||
        !clean(body.summary, 5, 300) ||
        typeof body.published !== 'boolean',
      400,
      'Judul, deskripsi, dan status publikasi harus valid.',
    );
    fail(
      !Number.isInteger(body.minutes) || body.minutes < 1 || body.minutes > 180,
      400,
      'Durasi harus 1–180 menit.',
    );
    fail(
      !Array.isArray(body.blocks) ||
        body.blocks.length !== topic.attributes.length ||
        body.blocks.some((b, i) => !b || !validLesson({ ...topic.blocks[i], ...b })),
      400,
      'Isi semua bagian materi dan contoh dengan benar.',
    );
    // Assessments retain their question snapshots; content edits cannot change submitted evidence.
    for (const bank of ['pre', 'post']) {
      fail(
        !Array.isArray(body[bank]) || body[bank].length !== topic[bank].length,
        400,
        'Jumlah soal harus tetap sesuai pemetaan atribut.',
      );
      body[bank].forEach((q, i) => {
        fail(
          !q ||
            q.id !== topic[bank][i].id ||
            !clean(q.text, 5, 600) ||
            !Array.isArray(q.options) ||
            q.options.length !== 4 ||
            q.options.some((o) => !clean(o, 1, 300)) ||
            !Number.isInteger(q.answer) ||
            q.answer < 0 ||
            q.answer > 3 ||
            !clean(q.explanation, 5, 1200),
          400,
          'Teks, opsi, kunci, dan pembahasan soal harus valid.',
        );
      });
    }
    const next = {
      ...topic,
      title: body.title.trim(),
      summary: body.summary.trim(),
      minutes: body.minutes,
      published: body.published,
      blocks: body.blocks.map((b, i) => normalizeLesson({ ...topic.blocks[i], ...b })),
      pre: body.pre.map((q, i) => ({
        ...topic.pre[i],
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()),
        answer: q.answer,
        explanation: q.explanation.trim(),
      })),
      post: body.post.map((q, i) => ({
        ...topic.post[i],
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()),
        answer: q.answer,
        explanation: q.explanation.trim(),
      })),
    };
    db.prepare('UPDATE topics SET data=? WHERE id=?').run(JSON.stringify(next), topic.id);
    audit(user.id, 'topic.updated', topic.id);
    return { topic: next };
  });

  const server = createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url, 'http://edubridge.local');
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        const remote = addressFor(req);
        const rateKey = `${remote}:${url.pathname.startsWith('/api/auth/') ? url.pathname : 'api'}`;
        const entry = requestAttempts.get(rateKey);
        const max = url.pathname.startsWith('/api/auth/') && req.method !== 'GET' ? 120 : 6000;
        fail(
          entry?.until > Date.now() && entry.count >= max,
          429,
          'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
        );
        requestAttempts.set(rateKey, {
          count: entry?.until > Date.now() ? entry.count + 1 : 1,
          until: entry?.until > Date.now() ? entry.until : Date.now() + 60000,
        });
        if (requestAttempts.size > 10000)
          for (const [id, value] of requestAttempts)
            if (value.until < Date.now()) requestAttempts.delete(id);
        fail(
          !['GET', 'HEAD'].includes(req.method) && req.headers['sec-fetch-site'] === 'cross-site',
          403,
          'Permintaan lintas situs ditolak.',
        );
        if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
          const allowed = new Set([
            ...(!production
              ? [
                  'http://127.0.0.1:5173',
                  'http://localhost:5173',
                  `http://${req.headers.host}`,
                  `https://${req.headers.host}`,
                ]
              : []),
            process.env.APP_ORIGIN,
            ...(process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
          ]);
          fail(!allowed.has(req.headers.origin), 403, 'Asal permintaan tidak diizinkan.');
        }
        const selected = routes.find(
          (r) => r.method === req.method && r.pattern.test(url.pathname),
        );
        fail(!selected, 404, 'Endpoint tidak ditemukan.');
        const token = req.headers.cookie?.match(/(?:^|; )edubridge_session=([^;]+)/)?.[1];
        const user = token
          ? db
              .prepare(
                'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.expires_at>? AND u.active=1',
              )
              .get(tokenHash(token), now())
          : null;
        if (selected.roles) {
          fail(!user, 401, 'Sesi berakhir. Silakan masuk kembali.');
          res.setHeader('X-CSRF-Token', csrfFor(token));
          if (!['GET', 'HEAD'].includes(req.method)) {
            const supplied = req.headers['x-csrf-token'];
            const expected = csrfFor(token);
            if (
              typeof supplied !== 'string' ||
              !/^[a-f0-9]{64}$/.test(supplied) ||
              !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
            ) {
              const error = new HttpError(
                403,
                'Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.',
              );
              error.code = 'csrf_invalid';
              throw error;
            }
          }
          fail(
            selected.roles.length && !selected.roles.includes(user.role),
            403,
            'Akun Anda tidak memiliki akses ke fitur ini.',
          );
        }
        const data = await selected.handler({
          req,
          res,
          user,
          params: selected.pattern.exec(url.pathname).slice(1),
          url,
        });
        if (!res.writableEnded) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        }
        return;
      }
      fail(req.method !== 'GET' && req.method !== 'HEAD', 405, 'Metode tidak tersedia.');
      const root = resolve(staticDir);
      const path = resolve(root, '.' + decodeURIComponent(url.pathname));
      fail(path !== root && !path.startsWith(root + sep), 403, 'Path tidak valid.');
      const file =
        existsSync(path) && statSync(path).isFile()
          ? path
          : !extname(path)
            ? resolve(root, 'index.html')
            : null;
      fail(
        !file || !existsSync(file),
        404,
        'Halaman tidak ditemukan. Jalankan npm run build untuk menyiapkan frontend.',
      );
      const mime = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.woff2': 'font/woff2',
        '.ico': 'image/x-icon',
      };
      res.writeHead(200, {
        'Content-Type': `${mime[extname(file)] ?? 'application/octet-stream'}${['.html', '.js', '.css'].includes(extname(file)) ? '; charset=utf-8' : ''}`,
        'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) {
      if (res.writableEnded) return;
      if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
        error.status = 409;
        error.message = 'Data telah berubah atau sudah terdaftar. Muat ulang lalu coba lagi.';
      }
      if (!error.status)
        console.error(JSON.stringify({ event: 'request_failed', requestId, kind: error.name }));
      res.writeHead(error.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          error: error.status ? error.message : 'Terjadi kesalahan server. Coba lagi.',
          requestId,
          code: error.code === 'csrf_invalid' ? error.code : undefined,
        }),
      );
    }
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
