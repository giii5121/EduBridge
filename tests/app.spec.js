import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { initialTopics } from '../server/src/content.js';
const failures = new WeakMap();
test.beforeEach(async ({ page }) => {
  failures.set(page, []);
  page.on('pageerror', (error) => failures.get(page).push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(failures.get(page)).toEqual([]);
});
async function demo(page, role) {
  await page.goto('/login');
  await page.getByRole('button', { name: role, exact: true }).click();
  await expect(page).toHaveURL(
    role === 'Guru' ? /\/guru$/ : role === 'Admin' ? /\/admin$/ : /\/dashboard$/,
  );
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}

test('student dashboard, catalog search, progress, profile, and desktop design', async ({
  page,
}) => {
  mkdirSync('artifacts', { recursive: true });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Siap makin paham?' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/login-desktop.png', fullPage: true });
  await demo(page, 'Siswa');
  await expect(page.getByRole('heading', { name: 'Halo, Nadia!' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Katalog materi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ruang untuk makin paham.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Cari di katalog' }).fill('lingkaran');
  await expect(page.locator('.topic-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Cari di katalog' }).fill('tidakditemukan');
  await expect(page.getByRole('heading', { name: 'Topiknya belum ditemukan' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset pencarian' }).click();
  await expect(page.locator('.topic-card')).toHaveCount(6);
  await page.screenshot({ path: 'artifacts/catalog-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Progres belajar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kemajuanmu, terlihat jelas.' })).toBeVisible();
  await page.getByRole('link', { name: 'Profil saya', exact: true }).click();
  await page.getByRole('button', { name: /Pencapaian/ }).click();
  await expect(page.locator('.achievement')).toHaveCount(6);
  await page.getByRole('button', { name: 'Tentang diagnosis' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Keluar akun' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('registration, persisted assessment, lesson, teacher release, posttest, and diagnosis comparison', async ({
  page,
  browser,
}) => {
  await page.goto('/register');
  await page.getByLabel('Nama lengkap', { exact: true }).fill('Siswa Browser');
  await page.getByLabel('Email', { exact: true }).fill('browser@example.id');
  await page.getByLabel('Kata sandi', { exact: true }).fill('Browser123!');
  await page.getByLabel('Asal sekolah', { exact: true }).fill('SMA Browser');
  await page.getByLabel('Kode kelas', { exact: true }).fill('BRIDGE11');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Buat akun siswa' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Halo, Siswa!' })).toBeVisible();
  await page.goto('/kuis?subject=geometri&mode=pretest');
  await page.getByRole('button', { name: /Mulai \/ lanjutkan pretest/ }).click();
  await expect(page).toHaveURL(/\/kuis\/kerjakan\//);
  await page.getByRole('radio').nth(1).click();
  await expect(page.getByText('Tersimpan di server')).toBeVisible();
  const attemptUrl = page.url();
  await page.reload();
  await page.getByRole('button', { name: 'Ke soal 1', exact: true }).click();
  await expect(page.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
  for (let i = 0; i < 14; i++) {
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    await page.getByRole('radio').nth(0).click();
    await expect(page.getByText('Tersimpan di server')).toBeVisible();
  }
  await page.screenshot({ path: 'artifacts/assessment-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Kumpulkan asesmen', exact: true }).click();
  await page.getByRole('button', { name: 'Ya, kumpulkan' }).click();
  await expect(page).toHaveURL(/\/kuis\/hasil\//);
  await expect(page.getByText('PDINA · Kalibrasi sintetis', { exact: true })).toBeVisible();
  await page.getByRole('button', {name: 'Buat ringkasan hasil'}).click();
  await expect(page.locator('.narrative-copy')).toContainText('Ringkasan');
  await page.getByRole('button', { name: 'Buka pembahasan' }).click();
  await expect(page.locator('.review-list article')).toHaveCount(15);
  await page.getByRole('link', { name: 'Ke materi penguatan' }).click();
  await expect(page.locator('.concept-section')).toHaveCount(9);
  await expect(page.locator('.worked-example')).toHaveCount(3);
  await expect(page.locator('.self-practice')).toHaveCount(6);
  await page
    .getByRole('textbox', { name: 'Jawaban latihan mandiri geometri-0-a' })
    .fill('73 derajat, karena sudut pusat dibagi dua.');
  await page.getByRole('button', { name: 'Bandingkan dengan pembahasan' }).click();
  await expect(page.locator('.practice-reveal').first()).toContainText('73°');
  await page
    .locator('.concept-caution')
    .first()
    .screenshot({ path: 'artifacts/concept-caution.png' });
  await page
    .locator('.worked-example')
    .first()
    .screenshot({ path: 'artifacts/concept-example.png' });
  await expect(page.getByRole('button', { name: 'Tandai sudah dipelajari' })).toHaveCount(3);
  for (let i = 0; i < 3; i++)
    await page
      .getByRole('button', { name: 'Tandai sudah dipelajari', exact: true })
      .first()
      .click();
  await page.getByRole('button', { name: 'Selesaikan materi' }).click();
  await expect(
    page.getByRole('heading', { name: 'Satu langkah lagi sudah kamu tuntaskan.' }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Pertanyaan pendamping belajar' })
    .fill('Bantu jelaskan garis singgung');
  await page.getByRole('button', { name: 'Kirim pertanyaan' }).click();
  await expect(page.locator('.chat-bubble.assistant').last()).toContainText('Mari pelajari');
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await demo(teacher, 'Guru');
  await teacher.getByLabel('Fokus topik kelas').selectOption('geometri');
  await teacher.getByRole('button', {name: 'Buat ringkasan kelas'}).click();
  await expect(teacher.locator('.narrative-copy')).toContainText('Ringkasan kelas');
  await teacher.getByRole('button', { name: /Asesmen akhir/ }).click();
  await expect(teacher.getByRole('status')).toContainText('Fase kelas diubah');
  await page.reload();
  await page.getByRole('link', { name: 'Kerjakan posttest', exact: true }).click();
  await page.getByRole('button', { name: /Mulai \/ lanjutkan posttest/ }).click();
  const answers = initialTopics.find(t => t.id === 'geometri').post.map(q => q.answer);
  for (let i = 0; i < answers.length; i++) {
    await page.getByRole('radio').nth(answers[i]).click();
    await expect(page.getByText('Tersimpan di server')).toBeVisible();
    if (i < answers.length - 1) await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Kumpulkan asesmen', exact: true }).click();
  await page.getByRole('button', { name: 'Ya, kumpulkan' }).click();
  await expect(page.locator('.result-score')).toContainText('100');
  await expect(page.locator('.comparison-summary')).toContainText('gap tertutup');
  await page.screenshot({ path: 'artifacts/result-desktop.png', fullPage: true });
  await page.setViewportSize({width:320,height:900});
  await noOverflow(page);
  await page.screenshot({path:'artifacts/result-pdina-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(attemptUrl);
  await expect(page).toHaveURL(/\/kuis\/hasil\//);
  await teacherContext.close();
});

test('teacher controls, student diagnostics, class creation, and export', async ({ page }) => {
  await demo(page, 'Guru');
  await expect(page.getByRole('heading', { name: 'Pahami kebutuhan setiap siswa.' })).toBeVisible();
  await expect(page.locator('.heat-cell').first()).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/teacher-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Detail Nadia Putri' }).click();
  await expect(page.getByRole('dialog')).toContainText('Perjalanan Nadia Putri');
  await page.getByRole('button', { name: 'Tutup dialog' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Ekspor CSV' }).click();
  expect((await downloaded).suggestedFilename()).toContain('edubridge-kelas');
  await page.getByRole('button', { name: 'Buat kelas', exact: true }).click();
  await page.getByLabel('Nama kelas', { exact: true }).fill('XI Browser 2');
  await page.getByRole('dialog').getByRole('button', { name: 'Buat kelas', exact: true }).click();
  await expect(page.getByText('Siswa belum bergabung')).toBeVisible();
  await expect(page.locator('.class-code')).toContainText('XI');
});

test('admin account creation, activation, material editing, and model status', async ({ page }) => {
  await demo(page, 'Admin');
  await expect(page.getByRole('heading', { name: 'Satu ruang, seluruh ekosistem.' })).toBeVisible();
  await page.getByRole('button', { name: 'Tambah akun', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nama lengkap').fill('Guru Browser');
  await dialog.getByLabel('Email', { exact: true }).fill('guru-browser@example.id');
  await dialog.getByLabel('Kata sandi awal').fill('Browser123!');
  await dialog.getByRole('combobox', { name: 'Peran', exact: true }).selectOption('teacher');
  await dialog.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page.getByText('guru-browser@example.id')).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'guru-browser@example.id' });
  await row.getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Nonaktifkan akun', exact: true })
    .click();
  await expect(row.getByText('Nonaktif', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Materi & bank soal' }).click();
  await page.screenshot({ path: 'artifacts/admin-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page
    .getByRole('textbox', { name: 'Deskripsi', exact: true })
    .fill('Kenali fungsi komposisi dan invers melalui penguatan konsep matematika XI.');
  await page.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Layanan diagnosis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Diagnosis lokal, penjelasan terarah.' })).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await noOverflow(page);
});

test('mobile student navigation and responsive core screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page, 'Siswa');
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  for (const [label, heading] of [
    ['Katalog materi', 'Ruang untuk makin paham.'],
    ['Asesmen & latihan', 'Setiap jawaban punya cerita.'],
    ['Progres belajar', 'Kemajuanmu, terlihat jelas.'],
    ['Profil saya', 'Ini perjalananmu.'],
  ]) {
    await page.getByRole('button', { name: 'Buka navigasi' }).click();
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await noOverflow(page);
  }
  await page.screenshot({ path: 'artifacts/profile-mobile.png', fullPage: true });
});

test('staff layouts and content editor work on mobile and tablet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page, 'Guru');
  await expect(page.locator('.phase-buttons')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/teacher-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Buka navigasi' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await page.getByRole('button', { name: 'Keluar akun' }).click();
  await demo(page, 'Admin');
  await noOverflow(page);
  await page.getByRole('button', { name: 'Materi & bank soal' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await noOverflow(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Tutup dialog' }).click();
  await page.setViewportSize({ width: 768, height: 1024 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/admin-tablet.png', fullPage: true });
});
