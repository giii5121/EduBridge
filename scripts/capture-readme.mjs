// Real browser screenshots for README, using isolated demo data and the current build.
// Requires the local PDINA service; no new Gemini calls or production data writes.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase, seedDatabase } from '../server/src/database.js';
import { createApp } from '../server/src/app.js';
import { createModelClient } from '../server/src/modelClient.js';
import { upgradeDemoDiagnoses } from '../server/src/runtime.js';
import { initialTopics } from '../server/src/content.js';
import { validLesson } from '../server/src/lessonSchema.js';

if (existsSync('server/.env')) process.loadEnvFile('server/.env');
process.env.NODE_ENV = 'test';
process.env.SEED_DEMO = 'true';
const folder = resolve('snapshots/readme');
mkdirSync(folder, { recursive: true });
const db = openDatabase(':memory:');
seedDatabase(db);
const modelClient = createModelClient();
await upgradeDemoDiagnoses(db, modelClient);
const server = createApp(db, { production: false, modelClient });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome' });
const pages = [];
const captures = [];
const failures = [];
const secrets = Object.entries(process.env)
  .filter(([name, value]) => /KEY|PASSWORD|SECRET|TOKEN/i.test(name) && value.length > 8)
  .map(([, value]) => value);
const profiles = {
  desktop: { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

async function settle(page) {
  await page.waitForFunction(() => !document.querySelector('.loading'));
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('.math-fallback')].some(
        (el) => el.getBoundingClientRect().width && el.getBoundingClientRect().height,
      ),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => {
          const r = img.getBoundingClientRect();
          return r.width && r.height && r.bottom > 0 && r.top < innerHeight;
        })
        .map((img) => img.decode().catch(() => {})),
    );
  });
}
async function capture(page, device, id, title, path) {
  await settle(page);
  const unsafe = await page.evaluate((values) => {
    const text =
      document.body.innerText +
      '\n' +
      [...document.querySelectorAll('input,textarea')].map((el) => el.value).join('\n');
    return values.some((value) => text.includes(value));
  }, secrets);
  if (unsafe) throw new Error('Sensitive content detected. Screenshot cancelled.');
  if (await page.locator('[role="alert"]').count())
    throw new Error(`Unexpected error visible on ${id}/${device}.`);
  if (
    await page.locator('img').evaluateAll((images) =>
      images.some((img) => {
        const r = img.getBoundingClientRect();
        return (
          r.width &&
          r.height &&
          r.bottom > 0 &&
          r.top < innerHeight &&
          (!img.complete || img.naturalWidth === 0)
        );
      }),
    )
  )
    throw new Error(`Missing image on ${id}/${device}.`);
  if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)))
    throw new Error(`Horizontal overflow on ${id}/${device}.`);
  const file = `${id}-${device}.png`;
  await page.screenshot({
    path: resolve(folder, file),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });
  captures.push({ file, title, device, route: path, viewport: profiles[device].viewport });
  console.log(`Captured ${file}`);
}
async function goto(page, path) {
  await page.goto(base + path);
  await settle(page);
}
async function login(page, role) {
  await page.context().clearCookies();
  await page.goto(base + '/login');
  if (role === 'Dimas') {
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('dimas@edubridge.id');
    await page.getByLabel('Kata sandi', { exact: false }).first().fill('EduBridge123!');
    await page.getByRole('button', { name: 'Masuk ke EduBridge', exact: true }).click();
  } else await page.getByRole('button', { name: role, exact: true }).click();
  await page.waitForURL(
    role === 'Guru' ? '**/guru' : role === 'Admin' ? '**/admin' : '**/dashboard',
    { timeout: 35000 },
  );
  await settle(page);
}
async function position(page, locator, offset = 110) {
  await locator.evaluate(
    (el, offset) =>
      window.scrollTo({
        top: el.getBoundingClientRect().top + scrollY - offset,
        behavior: 'instant',
      }),
    offset,
  );
}
async function seedMaterials() {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'guru@edubridge.id', password: 'EduBridge123!' }),
  });
  if (!response.ok) throw new Error('Demo teacher authentication failed.');
  const headers = {
    'Content-Type': 'application/json',
    Cookie: response.headers.get('set-cookie').split(';')[0],
    'X-CSRF-Token': response.headers.get('x-csrf-token'),
  };
  const draftPath = resolve('artifacts/generated-material-preview.json');
  const source = existsSync(draftPath) ? JSON.parse(readFileSync(draftPath, 'utf8')).draft : null;
  const usable = source && source.blocks?.length && source.blocks.every(validLesson);
  const topic = initialTopics[0];
  const draft = usable
    ? source
    : {
        title: 'Penguatan komposisi fungsi',
        summary: topic.summary,
        minutes: 25,
        blocks: topic.blocks,
      };
  const result = await fetch(base + '/api/materials', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...draft,
      classId: 'class-xi1',
      topicId: topic.id,
      published: false,
      reviewConfirmed: false,
      aiGenerated: Boolean(usable),
    }),
  });
  if (!result.ok) throw new Error('Could not prepare the isolated lesson draft.');
  const created = (await result.json()).material;
  for (const topic of initialTopics.slice(1, 3)) {
    const result = await fetch(base + '/api/materials', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: topic.title + ' — penguatan kelas',
        summary: topic.summary,
        minutes: 20,
        blocks: topic.blocks,
        classId: 'class-xi1',
        topicId: topic.id,
        published: true,
        reviewConfirmed: true,
      }),
    });
    if (!result.ok) throw new Error('Could not prepare the isolated material catalog.');
  }
  return created;
}

try {
  const draft = await seedMaterials();
  for (const [device, profile] of Object.entries(profiles)) {
    const context = await browser.newContext({
      ...profile,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', (error) => failures.push(error.message));
    pages.push({ device, page });
    await goto(page, '/');
    await capture(page, device, '01-homepage', 'Homepage publik', '/');
    await login(page, 'Siswa');
    await capture(page, device, '02-belajar', 'Jalur belajar siswa', '/dashboard');
    await page.getByRole('button', { name: 'Aktifkan mode gelap', exact: true }).click();
    await capture(page, device, '03-mode-gelap', 'Jalur belajar dalam mode gelap', '/dashboard');
    await page.getByRole('button', { name: 'Aktifkan mode terang', exact: true }).click();
    await goto(page, '/katalog');
    await page.locator('.topic-card').first().waitFor();
    await position(page, page.locator('.catalog-toolbar'), device === 'mobile' ? 90 : 24);
    await capture(page, device, '04-katalog', 'Katalog matematika kelas XI', '/katalog');
    await goto(page, '/materi/geometri');
    await page.locator('.lesson-block').first().waitFor();
    await position(page, page.locator('.lesson-block').first(), device === 'mobile' ? 85 : 110);
    await capture(
      page,
      device,
      '05-penguatan',
      'Penguatan konsep dan rumus matematika',
      '/materi/geometri',
    );
    await goto(page, '/progres');
    await capture(page, device, '06-progres', 'Progres serta perbandingan pre/post', '/progres');
    await login(page, 'Dimas');
    await goto(page, '/kuis?subject=fungsi&mode=pretest');
    await page.getByRole('button', { name: /Mulai \/ lanjutkan pretest/ }).click();
    await page.waitForURL('**/kuis/kerjakan/**');
    const assessment = await page.request.get(
      page.url().replace('/kuis/kerjakan/', '/api/assessments/'),
    );
    const record = await assessment.json();
    const index = record.questions.findIndex((q) =>
      q.options.some((option) => option.includes('/')),
    );
    if (index < 0) throw new Error('No fraction question found for the quiz preview.');
    await page.getByRole('button', { name: `Ke soal ${index + 1}`, exact: true }).click();
    await page.locator('.question-card .katex').first().waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, device, '07-kuis', 'Asesmen CDA dengan rumus KaTeX', '/kuis/kerjakan/:id');
    await login(page, 'Guru');
    await page.locator('.heat-cell').first().waitFor();
    if (device === 'mobile') await position(page, page.locator('.phase-control'), 90);
    await capture(page, device, '08-guru', 'Ruang guru: fase kelas dan peta penguasaan', '/guru');
    await goto(page, '/kelola-materi');
    await page.getByRole('button', { name: `Edit ${draft.title}`, exact: true }).waitFor();
    await capture(
      page,
      device,
      '09-kelola-materi',
      'Pengelolaan materi guru dan admin',
      '/kelola-materi',
    );
    await page.getByRole('button', { name: `Edit ${draft.title}`, exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page
      .getByRole('textbox', { name: 'Arahan untuk AI', exact: true })
      .fill(
        'Jelaskan bertahap, gunakan konteks sehari-hari, dan fokus pada urutan komposisi fungsi.',
      );
    await page.getByRole('dialog').evaluate((dialog) => {
      dialog.scrollTop = 0;
    });
    await capture(
      page,
      device,
      '10-editor-ai',
      'Editor materi dengan generator AI dan validasi guru',
      '/kelola-materi',
    );
    await page.locator('.material-block-preview summary').first().click();
    await page.locator('.material-block-preview .katex').first().waitFor();
    await page
      .locator('.material-block-preview')
      .first()
      .evaluate((el) => {
        const dialog = el.closest('dialog');
        dialog.scrollTop +=
          el.getBoundingClientRect().top -
          dialog.getBoundingClientRect().top -
          dialog.querySelector('.modal-head').getBoundingClientRect().height -
          18;
      });
    await capture(
      page,
      device,
      '11-pratinjau',
      'Pratinjau hasil materi sebelum divalidasi',
      '/kelola-materi',
    );
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
    await login(page, 'Admin');
    await page.locator('tbody tr').first().waitFor();
    await capture(page, device, '12-admin', 'Panel admin untuk pengguna dan kelas', '/admin');
    await context.close();
  }
  if (failures.length) throw new Error(`Browser reported ${failures.length} runtime errors.`);
  writeFileSync(
    resolve(folder, 'manifest.json'),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        syntheticDemoData: true,
        localDatabaseModified: false,
        newGeminiCalls: 0,
        captures,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Saved ${captures.length} verified desktop/mobile screenshots to snapshots/readme.`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
}
