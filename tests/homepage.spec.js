import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('public homepage explains the learning cycle and provides working navigation without authentication', async ({
  page,
}) => {
  mkdirSync('snapshots', { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Paham konsepnya.');
  await expect(page.locator('.hp-steps article')).toHaveCount(4);
  await expect(page.locator('.hp-topics>a')).toHaveCount(6);
  await expect(page.locator('.hp-role-grid article')).toHaveCount(3);
  await page
    .getByRole('navigation', { name: 'Navigasi beranda' })
    .getByRole('link', { name: 'Cara kerja' })
    .click();
  await expect(page).toHaveURL(/#cara-kerja$/);
  await page
    .getByText('Apakah hasilnya sudah menjadi penilaian akademik final?', { exact: true })
    .click();
  await expect(page.locator('details[open]')).toContainText('data sintetis');
  await page.goto('/');
  await page.getByRole('link', { name: 'Mulai perjalananmu', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Masuk', exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('homepage supports desktop/mobile, persisted dark theme, accessible mobile navigation and signed-in return', async ({
  page,
}) => {
  mkdirSync('snapshots', { recursive: true });
  await page.emulateMedia({ colorScheme: 'light' });
  for (const width of [1600, 1000, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    if (width === 1600 || width === 390)
      await page.screenshot({ path: `snapshots/homepage-${width}-light.png`, fullPage: false });
  }
  await page.getByRole('button', { name: 'Buka menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tutup menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page
    .getByRole('navigation', { name: 'Navigasi beranda' })
    .getByRole('link', { name: 'FAQ', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Buka menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Aktifkan mode gelap' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: 'snapshots/homepage-1600-dark.png', fullPage: false });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Siswa', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Lanjutkan perjalanan', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Lanjutkan perjalanan', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('public homepage remains readable when the application API is unavailable and protected routes stay gated', async ({
  page,
}) => {
  await page.route('**/api/bootstrap', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Offline for test' }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Paham konsepnya.');
  await expect(page.getByRole('link', { name: 'Mulai perjalananmu', exact: true })).toBeVisible();
  await page.unroute('**/api/bootstrap');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
