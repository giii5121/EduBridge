import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.beforeEach(() => mkdirSync('artifacts', { recursive: true }));
const root = (page) => page.locator('html');
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}

test('theme follows the OS until explicitly chosen, then a persistent cookie wins across reloads and a reopened context', async ({
  page,
  context,
  browser,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'edubridge_theme'),
  ).toBeUndefined();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root(page)).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Aktifkan mode gelap' }).click();
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  const cookie = (await context.cookies()).find((value) => value.name === 'edubridge_theme');
  expect(cookie.value).toBe('dark');
  expect(cookie.path).toBe('/');
  expect(cookie.sameSite).toBe('Lax');
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 360 * 86400);
  await page.reload();
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101722');
  await page.screenshot({ path: 'artifacts/login-dark.png', fullPage: true });
  const saved = await context.storageState();
  const reopened = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    storageState: saved,
    colorScheme: 'light',
  });
  try {
    const next = await reopened.newPage();
    await next.goto('/register');
    await expect(root(next)).toHaveAttribute('data-theme', 'dark');
    await next.getByRole('button', { name: 'Aktifkan mode terang' }).click();
    await next.emulateMedia({ colorScheme: 'dark' });
    await next.reload();
    await expect(root(next)).toHaveAttribute('data-theme', 'light');
    expect((await reopened.cookies()).find((value) => value.name === 'edubridge_theme').value).toBe(
      'light',
    );
  } finally {
    await reopened.close();
  }
});

test('saved dark preference is applied even before the React entry script loads', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'edubridge_theme',
      value: 'dark',
      url: 'http://127.0.0.1:4173',
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
  ]);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.route('**/assets/index-*.js', (route) => route.abort());
  await page.goto('/login');
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  expect(await page.locator('#root').evaluate((el) => el.childElementCount)).toBe(0);
  expect(await root(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgb(16, 23, 34)',
  );
});

test('dark theme covers student learning, teacher/admin dialogs, mobile layout, and logout', async ({
  page,
  context,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Aktifkan mode gelap' }).click();
  await page.getByRole('button', { name: 'Siswa', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.app-main')).toHaveCSS('background-color', 'rgb(16, 23, 34)');
  await page.screenshot({ path: 'artifacts/dashboard-dark.png', fullPage: true });
  for (const path of ['/katalog', '/materi/geometri', '/kuis', '/progres', '/profil']) {
    await page.goto(path);
    await expect(root(page)).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.app-main')).toBeVisible();
    await noOverflow(page);
  }
  await page.goto('/materi/geometri');
  await expect(page.locator('.worked-example').first()).toBeVisible();
  await page
    .locator('.worked-example')
    .first()
    .screenshot({ path: 'artifacts/concept-example-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/dashboard-dark-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await noOverflow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Keluar akun' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  for (const role of ['Guru', 'Admin']) {
    await page.getByRole('button', { name: role, exact: true }).click();
    await expect(page).toHaveURL(role === 'Guru' ? /\/guru$/ : /\/admin$/);
    await expect(page.locator('.card').first()).toHaveCSS('background-color', 'rgb(24, 35, 52)');
    await page.screenshot({ path: `artifacts/${role.toLowerCase()}-dark.png`, fullPage: true });
    await page
      .getByRole('button', { name: role === 'Guru' ? 'Buat kelas' : 'Tambah akun', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(24, 35, 52)');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await expect(page.getByRole('button', { name: 'Aktifkan mode terang' })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Keluar akun' }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await context.cookies()).find((value) => value.name === 'edubridge_theme').value).toBe(
    'dark',
  );
  expect(errors).toEqual([]);
});
