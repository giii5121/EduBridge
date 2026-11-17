import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { initialTopics, legacyTopics } from './content.js';
import { diagnose } from './diagnosis.js';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$65536$8$2$${salt}$${scryptSync(password, salt, 64, { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 }).toString('hex')}`;
}
export function verifyPassword(password, hash) {
  try {
    const parts = hash.split('$');
    const modern = parts.length === 6 && parts[0] === 'scrypt';
    const [salt, stored] = modern ? parts.slice(4) : hash.split(':');
    const candidate = scryptSync(
      password,
      salt,
      64,
      modern
        ? {
            N: Number(parts[1]),
            r: Number(parts[2]),
            p: Number(parts[3]),
            maxmem: 128 * 1024 * 1024,
          }
        : {},
    );
    const expected = Buffer.from(stored, 'hex');
    return expected.length === candidate.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}
const derivePassword = promisify(scrypt);
export async function hashPasswordAsync(password) {
  const salt = randomBytes(16).toString('hex');
  const value = await derivePassword(password, salt, 64, {
    N: 65536,
    r: 8,
    p: 2,
    maxmem: 128 * 1024 * 1024,
  });
  return `scrypt$65536$8$2$${salt}$${value.toString('hex')}`;
}
export async function verifyPasswordAsync(password, hash) {
  try {
    const parts = hash.split('$');
    const modern = parts.length === 6 && parts[0] === 'scrypt';
    const [salt, stored] = modern ? parts.slice(4) : hash.split(':');
    const expected = Buffer.from(stored, 'hex');
    if (expected.length !== 64) return false;
    const options = modern
      ? { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: 128 * 1024 * 1024 }
      : {};
    const candidate = await derivePassword(password, salt, 64, options);
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}
export function openDatabase(
  path = process.env.DATABASE_PATH ||
    fileURLToPath(new URL('../data/edubridge.sqlite', import.meta.url)),
) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
      name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
      class_id TEXT REFERENCES classes(id), school TEXT NOT NULL DEFAULT 'SMA EduBridge',
      active INTEGER NOT NULL DEFAULT 1, reminders INTEGER NOT NULL DEFAULT 1,
      demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      teacher_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stages (
      class_id TEXT NOT NULL REFERENCES classes(id), topic_id TEXT NOT NULL REFERENCES topics(id),
      phase TEXT NOT NULL CHECK(phase IN ('pretest','learning','posttest')),
      PRIMARY KEY(class_id,topic_id)
    );
    CREATE TABLE IF NOT EXISTS cycles (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), topic_id TEXT NOT NULL REFERENCES topics(id),
      lesson_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL REFERENCES cycles(id), user_id TEXT NOT NULL REFERENCES users(id),
      topic_id TEXT NOT NULL REFERENCES topics(id), mode TEXT NOT NULL CHECK(mode IN ('pretest','posttest','remedial')),
      questions TEXT NOT NULL, responses TEXT, diagnosis TEXT, xp INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
      topic_id TEXT REFERENCES topics(id), xp INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS assessment_user ON assessments(user_id, completed_at);
    CREATE INDEX IF NOT EXISTS cycle_user_topic ON cycles(user_id,topic_id,created_at);
    CREATE INDEX IF NOT EXISTS activity_user ON activity(user_id,created_at);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS assessment_cycle_mode ON assessments(cycle_id,mode,completed_at);
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, target_id TEXT, created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function seedContent(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM topics').get().n === 0) {
    const insert = db.prepare('INSERT INTO topics(id,data) VALUES(?,?)');
    for (const topic of initialTopics) insert.run(topic.id, JSON.stringify(topic));
  }
  if (!db.prepare('SELECT id FROM schema_migrations WHERE id=?').get('extended-lessons-v2')) {
    db.exec('BEGIN');
    try {
      for (const topic of initialTopics) {
        const row = db.prepare('SELECT data FROM topics WHERE id=?').get(topic.id);
        if (!row) continue;
        const current = JSON.parse(row.data);
        const legacy = legacyTopics.find((t) => t.id === topic.id);
        current.blocks = current.blocks.map((block, i) => {
          const previous = legacy.blocks[i];
          const untouched =
            previous && ['title', 'body', 'example'].every((key) => block[key] === previous[key]);
          return untouched && !block.lessonVersion ? { ...block, ...topic.blocks[i] } : block;
        });
        if (current.minutes === legacy.minutes) current.minutes = topic.minutes;
        db.prepare('UPDATE topics SET data=? WHERE id=?').run(JSON.stringify(current), topic.id);
      }
      db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(
        'extended-lessons-v2',
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  if (!db.prepare('SELECT id FROM schema_migrations WHERE id=?').get('pdina-instrument-v1')) {
    db.exec('BEGIN');
    try {
      for (const topic of initialTopics) {
        const row = db.prepare('SELECT data FROM topics WHERE id=?').get(topic.id);
        if (!row) continue;
        const current = JSON.parse(row.data);
        for (const bank of ['pre', 'post']) {
          const existing = new Set(current[bank].map((q) => q.id));
          current[bank].push(...topic[bank].filter((q) => !existing.has(q.id)));
        }
        db.prepare('UPDATE topics SET data=? WHERE id=?').run(JSON.stringify(current), topic.id);
      }
      db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(
        'pdina-instrument-v1',
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function seedDatabase(db) {
  seedContent(db);
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  const now = new Date(Date.now() - 30 * 86400000).toISOString();
  const password = hashPassword('EduBridge123!');
  const user = db.prepare(
    'INSERT INTO users(id,email,password_hash,name,role,class_id,demo,created_at) VALUES(?,?,?,?,?,?,1,?)',
  );
  user.run('teacher-demo', 'guru@edubridge.id', password, 'Ratna Wulandari', 'teacher', null, now);
  user.run('admin-demo', 'admin@edubridge.id', password, 'Admin EduBridge', 'admin', null, now);
  db.prepare('INSERT INTO classes VALUES(?,?,?,?,?)').run(
    'class-xi1',
    'XI IPA 1',
    'BRIDGE11',
    'teacher-demo',
    now,
  );
  for (const [id, email, name] of [
    ['student-demo', 'siswa@edubridge.id', 'Nadia Putri'],
    ['student-arya', 'arya@edubridge.id', 'Arya Pratama'],
    ['student-citra', 'citra@edubridge.id', 'Citra Maharani'],
    ['student-dimas', 'dimas@edubridge.id', 'Dimas Saputra'],
  ])
    user.run(id, email, password, name, 'student', 'class-xi1', now);
  for (const topic of initialTopics)
    db.prepare('INSERT INTO stages VALUES(?,?,?)').run(
      'class-xi1',
      topic.id,
      topic.id === 'fungsi' ? 'posttest' : topic.id === 'geometri' ? 'learning' : 'pretest',
    );
  for (const [index, studentId] of ['student-demo', 'student-arya', 'student-citra'].entries()) {
    for (const topic of initialTopics.slice(0, 2)) {
      const cycleId = randomUUID();
      const date = new Date(Date.now() - (topic.id === 'fungsi' ? 2 : 1) * 86400000).toISOString();
      const complete = topic.id === 'fungsi';
      db.prepare('INSERT INTO cycles VALUES(?,?,?,?,?)').run(
        cycleId,
        studentId,
        topic.id,
        complete ? date : null,
        date,
      );
      for (const mode of complete ? ['pretest', 'posttest'] : ['pretest']) {
        const questions = mode === 'pretest' ? topic.pre : topic.post;
        const right =
          Math.floor(questions.length * (mode === 'pretest' ? 0.45 : 0.85)) + (index % 2);
        const responses = questions.map((q, i) => (i < right ? q.answer : (q.answer + 1) % 4));
        const result = diagnose(topic, questions, responses);
        const xp = mode === 'pretest' ? 60 : 100;
        db.prepare('INSERT INTO assessments VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
          randomUUID(),
          cycleId,
          studentId,
          topic.id,
          mode,
          JSON.stringify(questions),
          JSON.stringify(responses),
          JSON.stringify(result),
          xp,
          date,
          date,
        );
        db.prepare('INSERT INTO activity VALUES(?,?,?,?,?,?)').run(
          randomUUID(),
          studentId,
          mode,
          topic.id,
          xp,
          date,
        );
      }
      if (complete)
        db.prepare('INSERT INTO activity VALUES(?,?,?,?,?,?)').run(
          randomUUID(),
          studentId,
          'lesson',
          topic.id,
          40,
          date,
        );
    }
  }
}
