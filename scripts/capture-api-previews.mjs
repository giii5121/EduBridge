// Documentation screenshots and source-checked API references, using an isolated demo DB.
// Calls local P-DINA only. New paid Gemini requests are never made by this script.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase, seedDatabase } from '../server/src/database.js';
import { createApp } from '../server/src/app.js';
import { createModelClient } from '../server/src/modelClient.js';
import { initialTopics } from '../server/src/content.js';
import { buildApplicationReference, swaggerPage } from './application-api-reference.mjs';

if (existsSync('server/.env')) process.loadEnvFile('server/.env');
process.env.NODE_ENV = 'test';
process.env.SEED_DEMO = 'true';
const folder = resolve('snapshots/api');
mkdirSync(folder, { recursive: true });
const aiBase = (process.env.AI_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const secrets = new Set(
  Object.entries(process.env)
    .filter(([name, value]) => /KEY|PASSWORD|TOKEN|SECRET/i.test(name) && value.length > 8)
    .map(([, value]) => value),
);
const exchanges = [],
  captures = [],
  errors = [];
const db = openDatabase(':memory:');
seedDatabase(db);
const server = createApp(db, { production: false, modelClient: createModelClient() });
const originalHandler = server.listeners('request')[0];
server.removeAllListeners('request');
let appSpec, aiSpec;
server.on('request', (req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/reference/application' || path === '/reference/ai') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      swaggerPage(
        path.endsWith('application')
          ? { ...appSpec, servers: [{ url: '/', description: 'Isolated demo API' }] }
          : aiSpec,
        { interactive: true },
      ),
    );
    return;
  }
  originalHandler(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function redact(value, key = '') {
  if (/^(password|current|password_hash|csrf|cookie|authorization|session|serviceKey)$/i.test(key))
    return '[REDACTED]';
  if (
    (key === 'pre' || key === 'post' || key === 'questions') &&
    Array.isArray(value) &&
    value.some((q) => q && typeof q === 'object' && 'options' in q)
  )
    return '[REDACTED: private assessment question bank]';
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  if (typeof value === 'string') {
    for (const secret of secrets) if (secret) value = value.replaceAll(secret, '[REDACTED]');
  }
  return value;
}
function save(file, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  if ([...secrets].some((secret) => secret && text.includes(secret)))
    throw new Error('Sensitive output detected; documentation not written.');
  writeFileSync(resolve(folder, file), text);
}
function client() {
  return { cookie: '', csrf: '' };
}
async function call(
  actor,
  method,
  path,
  {
    body,
    operation = method + ' ' + path,
    parameters = {},
    title = operation,
    expected = 200,
    source = 'live-isolated-application',
  } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(actor.cookie ? { Cookie: actor.cookie } : {}),
      ...(actor.csrf ? { 'X-CSRF-Token': actor.csrf } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(95000),
  });
  if (response.headers.get('set-cookie')) {
    actor.cookie = response.headers.get('set-cookie').split(';')[0];
    if (actor.cookie.split('=')[1]) {
      secrets.add(actor.cookie);
      secrets.add(actor.cookie.split('=')[1]);
    }
  }
  if (response.headers.get('x-csrf-token')) {
    actor.csrf = response.headers.get('x-csrf-token');
    secrets.add(actor.csrf);
  }
  const data = response.headers.get('content-type')?.includes('json')
    ? await response.json()
    : await response.text();
  if (response.status !== expected)
    throw new Error(`${title} returned HTTP ${response.status}, expected ${expected}.`);
  exchanges.push({
    operation,
    title,
    method,
    path,
    parameters,
    status: response.status,
    requestBody: redact(body),
    responseBody: redact(data),
    source,
  });
  return data;
}
async function signIn(actor, email) {
  return call(actor, 'POST', '/api/auth/login', {
    body: { email, password: 'EduBridge123!', remember: true },
    title: 'Login demo: sesi HttpOnly dan token CSRF disembunyikan',
  });
}
const teacher = client(),
  student = client(),
  admin = client(),
  anonymous = client();
let material, attempt;
const payload = {
  title: 'Penguatan komposisi fungsi',
  summary: 'Pahami urutan komposisi fungsi melalui penjelasan dan contoh bertahap.',
  minutes: 20,
  topicId: 'fungsi',
  classId: 'class-xi1',
  published: false,
  reviewConfirmed: false,
  blocks: [
    {
      title: 'Urutan komposisi fungsi',
      body: 'Terapkan fungsi bagian dalam terlebih dahulu, kemudian gunakan hasilnya sebagai masukan fungsi bagian luar.',
      example: 'Jika $f(x)=2x$ dan $g(x)=x+1$, maka $f(g(x))=2x+2$.',
    },
  ],
};

async function prepare() {
  for (const path of ['/api/health', '/api/ready', '/api/config'])
    await call(anonymous, 'GET', path);
  await call(anonymous, 'GET', '/api/bootstrap', {
    expected: 401,
    title: '401: endpoint privat membutuhkan sesi',
  });
  await signIn(teacher, 'guru@edubridge.id');
  await call(teacher, 'GET', '/api/auth/me');
  await call(teacher, 'GET', '/api/classes');
  await call(teacher, 'POST', '/api/classes', {
    body: { name: 'XI Demo API' },
    title: 'Membuat kelas demo',
  });
  await call(teacher, 'GET', '/api/classes/class-xi1', {
    operation: 'GET /api/classes/{classId}',
    parameters: { classId: 'class-xi1' },
  });
  await call(teacher, 'GET', '/api/classes/class-xi1/export', {
    operation: 'GET /api/classes/{classId}/export',
    parameters: { classId: 'class-xi1' },
  });
  material = (
    await call(teacher, 'POST', '/api/materials', {
      body: payload,
      title: '200: menyimpan draf yang belum ditinjau',
    })
  ).material;
  await call(teacher, 'GET', '/api/materials');
  await call(teacher, 'GET', '/api/materials/' + material.id, {
    operation: 'GET /api/materials/{materialId}',
    parameters: { materialId: material.id },
  });
  await call(teacher, 'PATCH', '/api/materials/' + material.id, {
    operation: 'PATCH /api/materials/{materialId}',
    parameters: { materialId: material.id },
    body: { ...payload, version: material.version, published: true },
    expected: 422,
    title: '422: publikasi tanpa peninjauan manusia ditolak',
  });
  material = (
    await call(teacher, 'PATCH', '/api/materials/' + material.id, {
      operation: 'PATCH /api/materials/{materialId}',
      parameters: { materialId: material.id },
      body: { ...payload, version: material.version, published: true, reviewConfirmed: true },
      title: '200: materi diterbitkan setelah ditinjau',
    })
  ).material;
  await call(teacher, 'PATCH', '/api/materials/' + material.id, {
    operation: 'PATCH /api/materials/{materialId}',
    parameters: { materialId: material.id },
    body: { ...payload, version: 1, published: true, reviewConfirmed: true },
    expected: 409,
    title: '409: versi kedaluwarsa tidak boleh menimpa perubahan',
  });
  await call(student, 'POST', '/api/auth/register', {
    body: {
      name: 'Ayu Demo API',
      email: 'api-preview@example.id',
      password: 'EduBridge123!',
      school: 'SMA Contoh',
      classCode: 'BRIDGE11',
      agree: true,
    },
  });
  await call(student, 'GET', '/api/bootstrap');
  await call(student, 'PATCH', '/api/profile', {
    body: { name: 'Ayu Demo API', school: 'SMA Contoh', reminders: true },
  });
  await call(student, 'GET', '/api/admin/overview', {
    expected: 403,
    title: '403: siswa tidak memiliki akses administrasi',
  });
  attempt = await call(student, 'POST', '/api/assessments', {
    body: { topicId: 'geometri', mode: 'pretest' },
  });
  const parameters = { assessmentId: attempt.id };
  await call(student, 'GET', '/api/assessments/' + attempt.id, {
    operation: 'GET /api/assessments/{assessmentId}',
    parameters,
  });
  const responses = attempt.questions.map((q, i) => i % q.options.length);
  await call(student, 'PATCH', '/api/assessments/' + attempt.id, {
    operation: 'PATCH /api/assessments/{assessmentId}',
    parameters,
    body: { responses },
  });
  await call(student, 'POST', '/api/assessments/' + attempt.id + '/submit', {
    operation: 'POST /api/assessments/{assessmentId}/submit',
    parameters,
    body: { responses },
    title: '200: jawaban tersimpan dan diagnosis PDINA dihitung',
  });
  await call(student, 'POST', '/api/topics/geometri/lesson', {
    operation: 'POST /api/topics/{topicId}/lesson',
    parameters: { topicId: 'geometri' },
  });
  await call(teacher, 'PATCH', '/api/classes/class-xi1/phase', {
    operation: 'PATCH /api/classes/{classId}/phase',
    parameters: { classId: 'class-xi1' },
    body: { topicId: 'geometri', phase: 'posttest' },
  });
  await signIn(admin, 'admin@edubridge.id');
  await call(admin, 'GET', '/api/admin/overview');
  const user = (
    await call(admin, 'POST', '/api/admin/users', {
      body: {
        name: 'Guru Demo API',
        email: 'guru.api@example.id',
        password: 'EduBridge123!',
        role: 'teacher',
      },
    })
  ).user;
  await call(admin, 'PATCH', '/api/admin/users/' + user.id, {
    operation: 'PATCH /api/admin/users/{userId}',
    parameters: { userId: user.id },
    body: { active: false },
  });
  const topic = initialTopics[0];
  await call(admin, 'PATCH', '/api/admin/topics/' + topic.id, {
    operation: 'PATCH /api/admin/topics/{topicId}',
    parameters: { topicId: topic.id },
    body: {
      title: topic.title,
      summary: topic.summary,
      minutes: topic.minutes,
      published: topic.published,
      blocks: topic.blocks,
      pre: topic.pre,
      post: topic.post,
    },
    title: '200: struktur materi inti tetap sesuai instrumen',
  });
  await call(student, 'POST', '/api/profile/password', {
    body: { current: 'EduBridge123!', password: 'PreviewPassword456!' },
  });
  secrets.add('PreviewPassword456!');
  await call(student, 'POST', '/api/auth/logout');
  await call(teacher, 'DELETE', '/api/materials/' + material.id, {
    operation: 'DELETE /api/materials/{materialId}',
    parameters: { materialId: material.id },
    body: { version: material.version },
    title: '200: hapus materi tanpa mengubah riwayat asesmen',
  });
  const aiResponse = await fetch(aiBase + '/openapi.json');
  if (!aiResponse.ok) throw new Error('FastAPI OpenAPI is unavailable.');
  aiSpec = await aiResponse.json();
  const headers = {
    'Content-Type': 'application/json',
    ...(process.env.AI_SERVICE_KEY ? { 'X-Service-Key': process.env.AI_SERVICE_KEY } : {}),
  };
  const topicData = initialTopics[0];
  const pre = {
    model_id: 'edubridge',
    topic_id: topicData.id,
    student_id: 'SYN-API-DOCS',
    responses: topicData.pre.map((q, i) => ({ question_id: q.id, answer_option: i % 4 })),
  };
  const post = {
    ...pre,
    responses: topicData.post.map((q, i) => ({ question_id: q.id, answer_option: (i + 1) % 4 })),
  };
  for (const [path, body] of [
    ['/v1/diagnose', pre],
    ['/v1/compare', { pre, post }],
  ]) {
    const response = await fetch(aiBase + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('PDINA documentation request failed.');
    exchanges.push({
      operation: 'POST ' + path,
      title: 'Panggilan PDINA lokal dengan data sintetis',
      method: 'POST',
      path,
      requestBody: body,
      status: response.status,
      responseBody: redact(await response.json()),
      source: 'live-local-fastapi',
    });
  }
  const priorPath = 'artifacts/generated-material-preview.json';
  if (existsSync(priorPath)) {
    const prior = JSON.parse(readFileSync(priorPath, 'utf8'));
    const endpoint = aiSpec.paths['/v1/materials/generate']?.post;
    if (endpoint)
      endpoint.responses['200'].content['application/json'].example = redact({
        ...prior,
        draft: {
          title: prior.draft.title,
          summary: prior.draft.summary,
          minutes: prior.draft.minutes,
          blocks: prior.draft.blocks,
        },
      });
    exchanges.push({
      operation: 'POST /api/materials/generate',
      title: 'Contoh hasil uji Gemini nyata sebelumnya; tidak dipanggil ulang saat screenshot',
      method: 'POST',
      path: '/api/materials/generate',
      status: 200,
      requestBody: {
        topicId: 'fungsi',
        classId: 'class-xi1',
        title: 'Penguatan komposisi fungsi',
        sectionTitle: '',
        instructions:
          'Gunakan contoh sederhana sehari-hari dan jelaskan urutan fungsi bagian dalam terlebih dahulu.',
        blockCount: prior.draft.blocks.length,
      },
      responseBody: redact(prior),
      source: 'prior-live-gemini-artifact',
    });
  }
  appSpec = buildApplicationReference(exchanges);
  save('application-openapi.json', appSpec);
  save('ai-openapi.json', aiSpec);
  save('http-examples.json', {
    recordedAt: new Date().toISOString(),
    syntheticData: true,
    note: 'Headers rahasia, password, dan bank soal privat disamarkan. Sumber tiap contoh dicantumkan.',
    exchanges,
  });
  save('application.html', swaggerPage(appSpec));
  save('ai.html', swaggerPage(aiSpec));
  save(
    'endpoint-inventory.md',
    '# Referensi endpoint EduBridge\n\n' +
      Object.entries(appSpec.paths)
        .flatMap(([path, methods]) =>
          Object.entries(methods).map(
            ([method, op]) =>
              `- **${method.toUpperCase()} ${path}** — ${op.summary}. ${op.description.split('\n')[0]}`,
          ),
        )
        .join('\n') +
      '\n\n## FastAPI\n\n' +
      Object.entries(aiSpec.paths)
        .flatMap(([path, methods]) =>
          Object.entries(methods)
            .filter(([method]) => ['get', 'post', 'patch', 'delete'].includes(method))
            .map(([method, op]) => `- **${method.toUpperCase()} ${path}** — ${op.summary ?? ''}`),
        )
        .join('\n') +
      '\n',
  );
}

let browser;
async function screenshot(page, device, id, title) {
  await page.evaluate(() => document.fonts.ready);
  const unsafe = await page.evaluate(
    (values) => {
      const text =
        document.body.innerText +
        '\n' +
        [...document.querySelectorAll('input,textarea')].map((el) => el.value).join('\n');
      return values.some((value) => value && text.includes(value));
    },
    [...secrets],
  );
  if (unsafe) throw new Error('Sensitive content detected in API screenshot.');
  const file = id + '-' + device + '.png';
  await page.screenshot({
    path: resolve(folder, file),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });
  captures.push({ file, title, device });
  console.log('Captured ' + file);
}
function operation(page, method, path) {
  return page
    .locator(`.opblock.opblock-${method.toLowerCase()}`)
    .filter({ has: page.locator(`.opblock-summary-path[data-path="${path}"]`) });
}
async function open(page, method, path) {
  const op = operation(page, method, path);
  await op.locator('.opblock-summary').click();
  await op.locator('.opblock-body').waitFor();
  return op;
}
async function align(page, locator) {
  await locator.evaluate((el) =>
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 18, behavior: 'instant' }),
  );
}
async function execute(page, op, path, body) {
  await op.getByRole('button', { name: 'Try it out', exact: true }).click();
  if (body) await op.locator('textarea').fill(JSON.stringify(body, null, 2));
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path && response.request().method() === 'POST',
  );
  await op.getByRole('button', { name: 'Execute', exact: true }).click();
  const response = await pending;
  if (response.status() !== 200)
    throw new Error('Unexpected Swagger response: ' + response.status());
  await op.getByText('Server response', { exact: true }).waitFor();
}
try {
  await prepare();
  browser = await chromium.launch({ channel: 'chrome' });
  const profiles = {
    desktop: { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 },
    mobile: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  };
  for (const [device, profile] of Object.entries(profiles)) {
    const context = await browser.newContext({
      ...profile,
      reducedMotion: 'reduce',
      locale: 'id-ID',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', (error) => errors.push(error.message));
    // Inject request credentials outside Swagger's page state; omit sensitive response headers.
    await page.route('**/api/**', async (route) => {
      const response = await route.fetch({
        headers: {
          ...route.request().headers(),
          Cookie: teacher.cookie,
          'X-CSRF-Token': teacher.csrf,
        },
      });
      const headers = response.headers();
      for (const key of ['x-csrf-token', 'set-cookie', 'authorization']) delete headers[key];
      await route.fulfill({ response, headers });
    });
    await page.route(aiBase + '/v1/**', async (route) => {
      const response = await route.fetch({
        headers: {
          ...route.request().headers(),
          ...(process.env.AI_SERVICE_KEY ? { 'X-Service-Key': process.env.AI_SERVICE_KEY } : {}),
        },
      });
      await route.fulfill({ response });
    });
    await page.goto(aiBase + '/docs');
    await page.locator('.opblock').first().waitFor();
    await screenshot(page, device, '01-ai-swagger', 'Swagger UI FastAPI: seluruh endpoint AI');
    let op = await open(page, 'POST', '/v1/diagnose');
    const pre = exchanges.find((e) => e.operation === 'POST /v1/diagnose').requestBody;
    await execute(page, op, '/v1/diagnose', pre);
    await align(page, op.locator('.opblock-summary'));
    await screenshot(page, device, '02-diagnosis-request', 'Body request diagnosis CDA/CDM P-DINA');
    await align(page, op.getByText('Server response', { exact: true }));
    await screenshot(
      page,
      device,
      '03-diagnosis-response',
      'Respons nyata diagnosis PDINA: HTTP 200',
    );
    await page.goto(aiBase + '/docs');
    await page.locator('.opblock').first().waitFor();
    op = await open(page, 'POST', '/v1/compare');
    await execute(
      page,
      op,
      '/v1/compare',
      exchanges.find((e) => e.operation === 'POST /v1/compare').requestBody,
    );
    await align(page, op.getByText('Server response', { exact: true }));
    await screenshot(
      page,
      device,
      '11-prepost-response',
      'Respons nyata perbandingan CDA sebelum dan sesudah pembelajaran',
    );
    await page.goto(base + '/reference/ai');
    await page.locator('.opblock').first().waitFor();
    op = await open(page, 'POST', '/v1/materials/generate');
    await align(page, op.locator('.opblock-summary'));
    await screenshot(
      page,
      device,
      '04-generator-contract',
      'Kontrak generator materi AI: request, respons draf, dan validasi',
    );
    await page.goto(base + '/reference/application');
    await page.locator('.opblock').first().waitFor();
    await screenshot(
      page,
      device,
      '05-app-overview',
      'Swagger reference: 33 endpoint backend aplikasi',
    );
    op = await open(page, 'POST', '/api/auth/login');
    await align(page, op.locator('.opblock-summary'));
    await screenshot(page, device, '06-auth-contract', 'Autentikasi: body login dan cookie/CSRF');
    await page.goto(base + '/reference/application');
    await page.locator('.opblock').first().waitFor();
    op = await open(page, 'POST', '/api/materials');
    await align(page, op.locator('.opblock-summary'));
    await screenshot(
      page,
      device,
      '07-material-contract',
      'Materi: payload lengkap, draf, dan publikasi dengan peninjauan',
    );
    await page.goto(base + '/reference/application');
    await page.locator('.opblock').first().waitFor();
    op = await open(page, 'PATCH', '/api/materials/{materialId}');
    await align(page, op.locator('.response-col_status').filter({ hasText: /^409$/ }));
    await screenshot(
      page,
      device,
      '08-review-errors',
      'Contoh respons 409 dan 422: versi dan validasi materi',
    );
    await page.goto(base + '/reference/application');
    await page.locator('.opblock').first().waitFor();
    op = await open(page, 'POST', '/api/assessments/{assessmentId}/submit');
    await align(page, op.locator('.opblock-summary'));
    await screenshot(
      page,
      device,
      '09-assessment-contract',
      'Asesmen: pengumpulan jawaban dan hasil diagnosis',
    );
    await page.goto(base + '/reference/application');
    await page.locator('.opblock').first().waitFor();
    await align(page, page.locator('#operations-tag-Classes'));
    await screenshot(
      page,
      device,
      '10-class-admin-api',
      'API pengelolaan kelas, fase, ekspor, dan administrasi',
    );
    await context.close();
  }
  if (errors.length) throw new Error(`API browser reported ${errors.length} runtime errors.`);
  save('manifest.json', {
    capturedAt: new Date().toISOString(),
    applicationEndpointCount: Object.values(appSpec.paths).reduce(
      (n, path) => n + Object.keys(path).length,
      0,
    ),
    aiEndpointCount: Object.keys(aiSpec.paths).length,
    syntheticData: true,
    localDatabaseModified: false,
    newGeminiCalls: 0,
    sensitiveHeaders: 'omitted from screenshots',
    captures,
  });
  console.log(
    'Saved API references, HTTP evidence, and ' + captures.length + ' desktop/mobile screenshots.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
}
