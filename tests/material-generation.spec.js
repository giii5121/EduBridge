import { test, expect } from '@playwright/test';
import { initialTopics } from '../server/src/content.js';
import { mkdirSync } from 'node:fs';

const validation = 'Saya sudah meninjau dan memvalidasi kebenaran seluruh materi.';
async function start(page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guru', exact: true }).click();
  await expect(page).toHaveURL(/\/guru$/, { timeout: 20000 });
  await page.goto('/kelola-materi');
  await page.getByRole('button', { name: 'Tambah materi', exact: true }).click();
  await page.getByRole('combobox', { name: 'Akses materi', exact: true }).selectOption('class-xi1');
}
function generated(count, version = 1) {
  const topic = initialTopics[0];
  return {
    draft: {
      title: 'Komposisi fungsi hasil AI browser',
      summary: 'Materi penguatan komposisi fungsi yang perlu ditinjau guru sebelum diterbitkan.',
      minutes: 25,
      blocks: structuredClone(topic.blocks.slice(0, count)).map((b) => ({
        ...b,
        body: b.body + ` Penjelasan tambahan versi ${version}.`,
      })),
      published: false,
      aiGenerated: true,
      review: null,
    },
    provider: 'gemini',
    model: 'test-model',
    status: 'draft',
    requiresReview: true,
  };
}

test('AI fills all sections or just one; drafts require teacher validation and edits invalidate approval', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let calls = 0;
  await page.route('**/api/materials/generate', async (route) => {
    const body = route.request().postDataJSON();
    calls++;
    expect(body.classId).toBe('class-xi1');
    await route.fulfill({ json: generated(body.blockCount, calls) });
  });
  await start(page);
  await page
    .getByLabel('Arahan untuk AI', { exact: true })
    .fill('Fokus pada urutan komposisi, gunakan langkah sederhana.');
  await page.getByRole('combobox', { name: 'Jumlah bagian AI' }).selectOption('2');
  await page.getByRole('button', { name: 'Isi semua bagian dengan AI', exact: true }).click();
  await expect(page.locator('.material-block-editor')).toHaveCount(2);
  await page.locator('.material-block-preview summary').first().click();
  await expect(page.locator('.material-block-preview .katex').first()).toBeVisible();
  await page.locator('.material-block-preview summary').first().click();
  await expect(
    page.getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true }),
  ).not.toBeEmpty();
  await expect(
    page.getByRole('textbox', { name: 'Soal contoh', exact: true }).first(),
  ).not.toBeEmpty();
  await expect(page.getByLabel('Terbitkan materi agar terlihat oleh siswa')).toBeDisabled();
  const second = await page
    .getByRole('textbox', { name: 'Penjelasan bagian 2', exact: true })
    .inputValue();
  const first = await page
    .getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true })
    .inputValue();
  await page.getByRole('button', { name: 'Generate bagian 1', exact: true }).click();
  await page.getByRole('button', { name: 'Pertahankan isi', exact: true }).click();
  expect(calls).toBe(1);
  await expect(page.getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true })).toHaveValue(
    first,
  );
  await page.getByRole('button', { name: 'Generate bagian 1', exact: true }).click();
  await page.getByRole('button', { name: 'Generate dan ganti isi', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true })).toHaveValue(
    /versi 2/,
  );
  await expect(page.getByRole('textbox', { name: 'Penjelasan bagian 2', exact: true })).toHaveValue(
    second,
  );
  await page.getByLabel(validation).check();
  await page.getByLabel('Terbitkan materi agar terlihat oleh siswa').check();
  await page
    .getByRole('textbox', { name: 'Contoh bagian 1', exact: true })
    .fill('Contoh yang diperbaiki guru: jika $f(x)=2x$ dan $g(x)=x+1$, maka $f(g(x))=2x+2$.');
  await expect(page.getByLabel(validation)).not.toBeChecked();
  await expect(page.getByLabel('Terbitkan materi agar terlihat oleh siswa')).toBeDisabled();
  await page.getByRole('button', { name: 'Simpan materi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const card = page.locator('.material-card').filter({
    has: page.getByRole('heading', { name: 'Komposisi fungsi hasil AI browser', exact: true }),
  });
  await expect(card.getByText('Draf', { exact: true })).toBeVisible();
  const href = await card
    .getByRole('link', { name: 'Komposisi fungsi hasil AI browser', exact: true })
    .getAttribute('href');
  const context = await browser.newContext();
  const student = await context.newPage();
  try {
    await student.goto('/login');
    await student.getByRole('button', { name: 'Siswa', exact: true }).click();
    await expect(student).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await student.goto(href);
    await expect(student.getByRole('alert')).toContainText('Materi tidak ditemukan');
    await page
      .getByRole('button', { name: 'Edit Komposisi fungsi hasil AI browser', exact: true })
      .click();
    await page.getByLabel(validation).check();
    await page.getByLabel('Terbitkan materi agar terlihat oleh siswa').check();
    mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/material-ai-editor-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel(validation)).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: 'artifacts/material-ai-editor-mobile.png' });
    await page.getByRole('button', { name: 'Simpan materi', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await student.reload();
    await expect(
      student.getByRole('heading', { name: 'Komposisi fungsi hasil AI browser', exact: true }),
    ).toBeVisible();
    await expect(student.locator('.material-reader-block .katex').first()).toBeVisible();
    await page
      .getByRole('button', { name: 'Hapus Komposisi fungsi hasil AI browser', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Hapus materi', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await context.close();
  }
  expect(errors).toEqual([]);
});

test('provider failures and cancelling a pending generation preserve manual edits', async ({
  page,
}) => {
  await start(page);
  await page.getByLabel('Judul bagian 1', { exact: true }).fill('Materi manual guru');
  await page
    .getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true })
    .fill('Penjelasan asli yang harus tetap aman apabila AI mengalami gangguan.');
  await page.route('**/api/materials/generate', (route) =>
    route.fulfill({ status: 503, json: { error: 'Generator sementara tidak tersedia.' } }),
  );
  await page.getByRole('button', { name: 'Generate bagian 1', exact: true }).click();
  await page.getByRole('button', { name: 'Generate dan ganti isi', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Generator sementara tidak tersedia');
  await expect(page.getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true })).toHaveValue(
    'Penjelasan asli yang harus tetap aman apabila AI mengalami gangguan.',
  );
  await page.unroute('**/api/materials/generate');
  let release;
  await page.route('**/api/materials/generate', async (route) => {
    await new Promise((resolve) => (release = resolve));
    await route.fulfill({ json: generated(1) }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Generate bagian 1', exact: true }).click();
  await page.getByRole('button', { name: 'Generate dan ganti isi', exact: true }).click();
  await expect(page.locator('.material-ai-progress')).toBeVisible();
  await expect.poll(() => typeof release).toBe('function');
  await page.getByRole('button', { name: 'Batalkan pengisian', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true })
    .fill('Isi manual setelah pembatalan harus dipertahankan.');
  release();
  await expect(page.getByRole('textbox', { name: 'Penjelasan bagian 1', exact: true })).toHaveValue(
    'Isi manual setelah pembatalan harus dipertahankan.',
  );
});
