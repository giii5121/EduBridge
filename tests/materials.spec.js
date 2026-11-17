import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function demo(page, role) {
  await page.goto('/login');
  await page.getByRole('button', { name: role, exact: true }).click();
  await expect(page).toHaveURL(
    role === 'Guru' ? /\/guru$/ : role === 'Admin' ? /\/admin$/ : /\/dashboard$/,
    { timeout: 15000 },
  );
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
const original = 'Penguatan lingkaran kelas browser';
async function fillMaterial(page, title) {
  await page.getByLabel('Judul materi', { exact: true }).fill(title);
  await page
    .getByLabel('Deskripsi materi', { exact: true })
    .fill(
      'Pahami sudut lingkaran melalui penjelasan dan contoh yang dekat dengan pembelajaran kelas.',
    );
  await page.getByLabel('Topik penguatan', { exact: true }).selectOption('geometri');
  await page.getByLabel('Judul bagian 1', { exact: true }).fill('Mengenal sudut pusat');
  await page
    .getByLabel('Penjelasan bagian 1', { exact: true })
    .fill(
      'Sudut pusat dua kali sudut keliling: $\\theta_p=2\\theta_k$. Pahami busur yang sama sebelum menghitung.',
    );
  await page
    .getByLabel('Contoh bagian 1', { exact: true })
    .fill('Jika sudut keliling $30^\\circ$, sudut pusat $60^\\circ$.');
}

test('teacher creates, publishes, edits and deletes a class material; students read clean math on desktop and mobile', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('artifacts', { recursive: true });
  await demo(page, 'Guru');
  await page.goto('/katalog');
  await page.getByRole('link', { name: 'Sesuaikan untuk kelas', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.material-block-editor')).toHaveCount(3);
  await expect(page.getByLabel('Soal contoh').first()).not.toBeEmpty();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah materi', exact: true }).click();
  await fillMaterial(page, original);
  await page.getByRole('combobox', { name: 'Akses materi', exact: true }).selectOption('class-xi1');
  await page.getByRole('button', { name: '+ Latihan mandiri', exact: true }).click();
  await page
    .getByLabel('Pertanyaan latihan', { exact: true })
    .fill('Berapa sudut pusat jika sudut keliling $40^\\circ$?');
  await page.getByLabel('Jawaban latihan', { exact: true }).fill('$80^\\circ$');
  await page
    .getByLabel('Pembahasan latihan', { exact: true })
    .fill('Kalikan sudut keliling dengan dua karena busurnya sama.');
  await page.getByLabel('Saya sudah meninjau dan memvalidasi kebenaran seluruh materi.').check();
  await page.getByLabel('Terbitkan materi agar terlihat oleh siswa').check();
  await page.getByRole('button', { name: 'Simpan materi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let card = page
    .locator('.material-card')
    .filter({ has: page.getByRole('heading', { name: original, exact: true }) });
  await expect(card.locator('.topic-illustration')).toBeVisible();
  await page.screenshot({ path: 'artifacts/materials-teacher-desktop.png', fullPage: true });
  const href = await card.getByRole('link', { name: original, exact: true }).getAttribute('href');
  const context = await browser.newContext();
  const student = await context.newPage();
  student.on('pageerror', (e) => errors.push(e.message));
  try {
    await demo(student, 'Siswa');
    await student.goto('/katalog');
    await student.getByLabel('Cari di katalog').fill(original);
    await expect(student.locator('.material-card')).toHaveCount(1);
    await student.getByRole('link', { name: original, exact: true }).click();
    await expect(student.getByRole('heading', { name: original, exact: true })).toBeVisible();
    await expect(student.locator('.material-reader-block .katex').first()).toBeVisible();
    await student.getByRole('button', { name: 'Lihat pembahasan', exact: true }).click();
    await expect(student.locator('.practice-reveal .katex')).toBeVisible();
    await noOverflow(student);
    await student.screenshot({ path: 'artifacts/materials-student-desktop.png', fullPage: true });
    await student.setViewportSize({ width: 390, height: 844 });
    await noOverflow(student);
    await student.getByRole('button', { name: 'Aktifkan mode gelap', exact: true }).click();
    await student.screenshot({
      path: 'artifacts/materials-student-mobile-dark.png',
      fullPage: true,
    });
    await student.setViewportSize({ width: 320, height: 780 });
    await noOverflow(student);
    await student.goto('/kelola-materi');
    await expect(student).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: `Edit ${original}`, exact: true }).click();
    await page.getByLabel('Judul materi', { exact: true }).fill(original + ' diperbarui');
    await page.getByLabel('Saya sudah meninjau dan memvalidasi kebenaran seluruh materi.').check();
    await page.getByLabel('Terbitkan materi agar terlihat oleh siswa').check();
    await page.getByRole('button', { name: 'Simpan materi', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await student.goto(href);
    await expect(
      student.getByRole('heading', { name: original + ' diperbarui', exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: `Edit ${original} diperbarui`, exact: true }).click();
    await noOverflow(page);
    await page.screenshot({ path: 'artifacts/materials-editor-mobile.png' });
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    await page.getByRole('button', { name: `Hapus ${original} diperbarui`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: original + ' diperbarui', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: `Hapus ${original} diperbarui`, exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Hapus materi', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await student.reload();
    await expect(student.getByRole('alert')).toContainText('Materi tidak ditemukan');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('admin publishes and edits global learning materials, including draft visibility', async ({
  page,
  browser,
}) => {
  const title = 'Lingkaran untuk seluruh siswa browser';
  await demo(page, 'Admin');
  await page.goto('/kelola-materi');
  await page.getByRole('button', { name: 'Tambah materi', exact: true }).click();
  await fillMaterial(page, title);
  await expect(page.getByLabel('Akses materi', { exact: true })).toHaveValue('global');
  await page.getByRole('button', { name: 'Simpan materi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const card = page
    .locator('.material-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(card.getByText('Draf', { exact: true })).toBeVisible();
  const href = await card.getByRole('link', { name: title, exact: true }).getAttribute('href');
  const context = await browser.newContext();
  const student = await context.newPage();
  try {
    await demo(student, 'Siswa');
    await student.goto(href);
    await expect(student.getByRole('alert')).toContainText('Materi tidak ditemukan');
    await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
    await page.getByLabel('Saya sudah meninjau dan memvalidasi kebenaran seluruh materi.').check();
    await page.getByLabel('Terbitkan materi agar terlihat oleh siswa').check();
    await page.getByRole('button', { name: 'Simpan materi', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await student.reload();
    await expect(student.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(
      student.locator('.material-reader-head').getByText('Semua kelas', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: `Hapus ${title}`, exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Hapus materi', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
