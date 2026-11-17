// Opt-in: one live Gemini call through isolated FastAPI + application API.
// All authentication, draft saves, and approval checks use an in-memory demo database.
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openDatabase, seedDatabase } from '../server/src/database.js';
import { createApp } from '../server/src/app.js';
import { createModelClient } from '../server/src/modelClient.js';
import { runPython } from './python.mjs';

process.loadEnvFile('server/.env');
if (!process.argv.includes('--confirm')) {
  console.log(
    'Dry run. Add --confirm for one live Gemini lesson-generation call and isolated publication checks.',
  );
  process.exit(0);
}
if (process.env.LLM_ENABLED !== 'true' || !process.env.GEMINI_API_KEY)
  throw new Error('Configure LLM_ENABLED and GEMINI_API_KEY in server/.env first.');
const secrets = [process.env.GEMINI_API_KEY, process.env.AI_SERVICE_KEY].filter(Boolean);
const reserved = createServer();
await new Promise((resolve) => reserved.listen(0, '127.0.0.1', resolve));
const port = reserved.address().port;
await new Promise((resolve) => reserved.close(resolve));
const key = process.env.AI_SERVICE_KEY || randomBytes(32).toString('hex');
const blockCount = Number(
  process.argv.find((arg) => arg.startsWith('--blocks='))?.split('=')[1] ?? 1,
);
if (!Number.isInteger(blockCount) || blockCount < 1 || blockCount > 6)
  throw new Error('--blocks must be an integer from 1 to 6.');
const aiBase = `http://127.0.0.1:${port}`;
const ai = runPython(['-m', 'web.run'], {
  env: {
    ...process.env,
    NODE_ENV: 'test',
    AI_HOST: '127.0.0.1',
    AI_PORT: String(port),
    AI_SERVICE_KEY: key,
  },
});
let db, server;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (ai.exitCode !== null) throw new Error('Isolated AI process exited.');
    try {
      if ((await fetch(aiBase + '/ready', { signal: AbortSignal.timeout(500) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Isolated AI process is unavailable.');
  process.env.NODE_ENV = 'test';
  process.env.SEED_DEMO = 'true';
  db = openDatabase(':memory:');
  seedDatabase(db);
  server = createApp(db, {
    production: false,
    modelClient: createModelClient({ baseUrl: aiBase, key }),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = '',
    csrf = '';
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Cookie: cookie,
        'X-CSRF-Token': csrf,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(95000),
    });
    if (response.headers.get('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0];
    if (response.headers.get('x-csrf-token')) csrf = response.headers.get('x-csrf-token');
    return { status: response.status, body: await response.json() };
  }
  const login = await request('/auth/login', 'POST', {
    email: 'guru@edubridge.id',
    password: 'EduBridge123!',
  });
  if (login.status !== 200) throw new Error('Isolated teacher login failed.');
  const started = Date.now();
  const generation = await request('/materials/generate', 'POST', {
    topicId: 'fungsi',
    classId: 'class-xi1',
    title: 'Penguatan komposisi fungsi',
    sectionTitle: blockCount === 1 ? 'Urutan komposisi fungsi' : '',
    blockCount,
    instructions:
      'Gunakan contoh sederhana sehari-hari dan jelaskan urutan fungsi bagian dalam terlebih dahulu.',
  });
  if (generation.status !== 200)
    throw new Error(`Generation failed (HTTP ${generation.status}); no draft was published.`);
  const draft = {
    ...generation.body.draft,
    topicId: 'fungsi',
    classId: 'class-xi1',
    reviewConfirmed: false,
  };
  const saved = await request('/materials', 'POST', draft);
  if (saved.status !== 200 || saved.body.material.published || saved.body.material.review)
    throw new Error('Unreviewed draft must remain private.');
  const material = saved.body.material;
  const blocked = await request('/materials/' + material.id, 'PATCH', {
    ...material,
    published: true,
  });
  const approved = await request('/materials/' + material.id, 'PATCH', {
    ...material,
    published: true,
    reviewConfirmed: true,
  });
  if (blocked.status !== 422 || approved.status !== 200)
    throw new Error('Human-review publication gate failed.');
  const changed = await request('/materials/' + material.id, 'PATCH', {
    ...approved.body.material,
    title: 'Isi berubah setelah validasi',
  });
  if (changed.status !== 422) throw new Error('Content changes must invalidate prior approval.');
  const result = {
    checkedAt: new Date().toISOString(),
    provider: generation.body.provider,
    model: generation.body.model,
    generationHttp: generation.status,
    generatedBlocks: draft.blocks.length,
    elapsedMs: Date.now() - started,
    saveDraftHttp: saved.status,
    unreviewedPublishHttp: blocked.status,
    reviewedPublishHttp: approved.status,
    changedContentPublishHttp: changed.status,
    isolatedDatabase: true,
    liveProviderCalls: 1,
  };
  const summary = JSON.stringify(result, null, 2),
    preview = JSON.stringify(generation.body, null, 2);
  if (secrets.some((secret) => summary.includes(secret) || preview.includes(secret)))
    throw new Error('Refusing to write sensitive output.');
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/material-generation-live.json', summary + '\n');
  writeFileSync('artifacts/generated-material-preview.json', preview + '\n');
  console.log(summary);
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  db?.close();
  ai.kill();
}
