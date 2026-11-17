import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seedDatabase, seedContent } from '../src/database.js';
import { initialTopics, legacyTopics } from '../src/content.js';
import { progress } from '../src/domain.js';
import { validLesson } from '../src/lessonSchema.js';
import { createApp } from '../src/app.js';

test('content migration expands untouched lessons while preserving custom material, questions, and progress', () => {
  const db = openDatabase(':memory:');
  try {
    seedDatabase(db);
    const topic = structuredClone(legacyTopics[0]);
    topic.title = 'Judul buatan guru';
    topic.minutes = 25;
    topic.blocks[0].body = 'Penjelasan khusus dari guru yang perlu tetap dipertahankan.';
    topic.pre[0].text = 'Soal khusus yang sudah dibuat oleh administrator.';
    db.prepare('UPDATE topics SET data=? WHERE id=?').run(JSON.stringify(topic), topic.id);
    db.prepare('DELETE FROM schema_migrations WHERE id=?').run('extended-lessons-v2');
    const snapshots = db
      .prepare('SELECT id,questions,responses,diagnosis FROM assessments ORDER BY id')
      .all();
    seedContent(db);
    const next = JSON.parse(db.prepare('SELECT data FROM topics WHERE id=?').get(topic.id).data);
    assert.equal(next.title, topic.title);
    assert.equal(next.minutes, 25);
    assert.equal(next.blocks[0].body, topic.blocks[0].body);
    assert.equal(next.pre[0].text, topic.pre[0].text);
    assert.equal(next.blocks[1].sections.length, 3);
    assert.equal(next.blocks[1].practice.length, 2);
    assert.deepEqual(
      db.prepare('SELECT id,questions,responses,diagnosis FROM assessments ORDER BY id').all(),
      snapshots,
    );
    const student = db.prepare('SELECT * FROM users WHERE id=?').get('student-demo');
    assert.equal(progress(db, student).xp, 260);
    seedContent(db);
    assert.deepEqual(
      JSON.parse(db.prepare('SELECT data FROM topics WHERE id=?').get(topic.id).data),
      next,
    );
  } finally {
    db.close();
  }
});

test('every concept contains validated explanations, worked steps, misconceptions, and retrieval practice', () => {
  const blocks = initialTopics.flatMap((topic) => topic.blocks);
  assert.equal(blocks.length, 18);
  assert.equal(
    blocks.reduce((n, block) => n + block.practice.length, 0),
    36,
  );
  for (const block of blocks) {
    assert.ok(validLesson(block));
    assert.equal(block.sections.length, 3);
    assert.ok(block.worked.steps.length >= 4);
    assert.ok(block.misconception.correction.length > 50);
  }
  assert.equal(new Set(blocks.flatMap((block) => block.practice.map((p) => p.id))).size, 36);
});

test('admin updates retain rich lesson data for older clients and reject malformed rich content', async () => {
  const db = openDatabase(':memory:');
  seedDatabase(db);
  const server = createApp(db);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@edubridge.id', password: 'EduBridge123!' }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const topic = structuredClone(initialTopics[0]);
    const legacyClient = {
      ...topic,
      blocks: topic.blocks.map(({ title, body, example }) => ({ title, body, example })),
    };
    const save = (body) =>
      fetch(`${base}/admin/topics/${topic.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'Content-Type': 'application/json',
          'X-CSRF-Token': login.headers.get('x-csrf-token'),
        },
        body: JSON.stringify(body),
      });
    const response = await save(legacyClient);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.topic.blocks[0].worked, topic.blocks[0].worked);
    const invalid = structuredClone(topic);
    invalid.blocks[0].worked.steps = 'not-an-array';
    assert.equal((await save(invalid)).status, 400);
    const edited = structuredClone(topic);
    edited.blocks[0].practice[0].explanation =
      'Penjelasan latihan yang sudah diperbarui oleh guru.';
    const update = await save(edited);
    assert.equal(update.status, 200);
    assert.equal(
      (await update.json()).topic.blocks[0].practice[0].explanation,
      edited.blocks[0].practice[0].explanation,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
