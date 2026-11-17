import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seedDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { createModelClient, ModelUnavailableError } from '../src/modelClient.js';
import { initialTopics } from '../src/content.js';
import { validateRuntime, validateProductionDatabase } from '../src/runtime.js';

test('CSRF, request origin, Secure cookies, and security headers protect mutations', async () => {
  const db = openDatabase(':memory:');
  seedDatabase(db);
  const app = createApp(db, { production: true });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}/api`;
  try {
    const login = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'siswa@edubridge.id', password: 'EduBridge123!' }),
    });
    assert.match(login.headers.get('set-cookie'), /Secure/);
    assert.match(login.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.match(login.headers.get('strict-transport-security'), /31536000/);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const csrf = login.headers.get('x-csrf-token');
    const mutate = (headers = {}) =>
      fetch(base + '/profile', {
        method: 'PATCH',
        headers: { cookie, 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: 'Nadia Putri', school: 'SMA EduBridge', reminders: true }),
      });
    assert.equal((await mutate()).status, 403);
    assert.equal(
      (await mutate({ 'X-CSRF-Token': csrf, Origin: 'https://evil.example' })).status,
      403,
    );
    assert.equal(
      (await mutate({ 'X-CSRF-Token': csrf, 'Sec-Fetch-Site': 'cross-site' })).status,
      403,
    );
    assert.equal((await mutate({ 'X-CSRF-Token': csrf })).status, 200);
  } finally {
    await new Promise((resolve) => app.close(resolve));
    db.close();
  }
});

test('inference outage preserves answers, awards no XP, and can be retried safely', async () => {
  const db = openDatabase(':memory:');
  seedDatabase(db);
  const real = createModelClient();
  let offline = true;
  const app = createApp(db, {
    modelClient: {
      ...real,
      diagnose: (...args) =>
        offline ? Promise.reject(new ModelUnavailableError()) : real.diagnose(...args),
    },
  });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}/api`;
  try {
    const login = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dimas@edubridge.id', password: 'EduBridge123!' }),
    });
    const headers = {
      cookie: login.headers.get('set-cookie').split(';')[0],
      'X-CSRF-Token': login.headers.get('x-csrf-token'),
      'Content-Type': 'application/json',
    };
    const topic = initialTopics[2];
    const started = await (
      await fetch(base + '/assessments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ topicId: topic.id, mode: 'pretest' }),
      })
    ).json();
    const body = JSON.stringify({ responses: topic.pre.map((q) => q.answer) });
    assert.equal(
      (await fetch(base + `/assessments/${started.id}/submit`, { method: 'POST', headers, body }))
        .status,
      503,
    );
    const saved = db.prepare('SELECT * FROM assessments WHERE id=?').get(started.id);
    assert.deepEqual(
      JSON.parse(saved.responses),
      topic.pre.map((q) => q.answer),
    );
    assert.equal(saved.completed_at, null);
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM activity WHERE user_id=?').get('student-dimas').n,
      0,
    );
    offline = false;
    const retried = await fetch(base + `/assessments/${started.id}/submit`, {
      method: 'POST',
      headers,
      body,
    });
    assert.equal(retried.status, 200);
    assert.equal((await retried.json()).result.provider, 'pdina');
    const narrative = await fetch(base + `/assessments/${started.id}/narrative`, {
      method: 'POST',
      headers,
    });
    assert.equal(narrative.status, 200);
    assert.equal((await narrative.json()).validation.ok, true);
  } finally {
    await new Promise((resolve) => app.close(resolve));
    db.close();
  }
});

test('production startup refuses incomplete secrets, HTTP origins, and implicit demo seeding', () => {
  assert.throws(() => validateRuntime({ NODE_ENV: 'production' }), /APP_ORIGIN/);
  assert.throws(
    () =>
      validateRuntime({
        NODE_ENV: 'production',
        APP_ORIGIN: 'http://example.com',
        AI_SERVICE_KEY: 'x'.repeat(40),
        DATABASE_PATH: '/data/app.sqlite',
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      validateRuntime({
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://example.com',
        AI_SERVICE_KEY: 'x'.repeat(40),
        DATABASE_PATH: '/data/app.sqlite',
        SEED_DEMO: 'true',
      }),
    /Demo accounts/,
  );
  assert.doesNotThrow(() =>
    validateRuntime({
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://example.com',
      AI_SERVICE_KEY: 'x'.repeat(40),
      DATABASE_PATH: '/data/app.sqlite',
    }),
  );
});

test('production requires a provisioned administrator and refuses accidental active demo accounts', () => {
  const db = openDatabase(':memory:');
  try {
    assert.throws(() => validateProductionDatabase(db, { NODE_ENV: 'production' }), /setup:admin/);
    seedDatabase(db);
    assert.throws(
      () => validateProductionDatabase(db, { NODE_ENV: 'production' }),
      /demo accounts/,
    );
    assert.doesNotThrow(() =>
      validateProductionDatabase(db, { NODE_ENV: 'production', ALLOW_DEMO_IN_PRODUCTION: 'true' }),
    );
    db.exec('UPDATE users SET active=0 WHERE demo=1');
    assert.throws(
      () => validateProductionDatabase(db, { NODE_ENV: 'production' }),
      /administrator/,
    );
    db.prepare(
      "INSERT INTO users(id,email,password_hash,name,role,created_at) SELECT 'prod-admin','prod@example.id',password_hash,'Admin Sekolah','admin',created_at FROM users WHERE id='admin-demo'",
    ).run();
    assert.doesNotThrow(() => validateProductionDatabase(db, { NODE_ENV: 'production' }));
  } finally {
    db.close();
  }
});
