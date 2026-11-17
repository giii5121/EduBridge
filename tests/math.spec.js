import { test, expect } from '@playwright/test';

const failures = new WeakMap();
test.beforeEach(async ({ page }) => {
  failures.set(page, []);
  page.on('pageerror', (error) => failures.get(page).push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(failures.get(page)).toEqual([]);
});

async function register(page, name) {
  await page.goto('/register');
  await page.getByLabel('Nama lengkap', { exact: true }).fill(`Siswa ${name}`);
  await page.getByLabel('Email', { exact: true }).fill(`${name}@example.id`);
  await page.getByLabel('Kata sandi', { exact: true }).fill('Rumus12345!');
  await page.getByLabel('Asal sekolah', { exact: true }).fill('SMA Rumus');
  await page.getByLabel('Kode kelas', { exact: true }).fill('BRIDGE11');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Buat akun siswa' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openQuestion(page, topic, pattern) {
  await page.goto(`/kuis?subject=${topic}&mode=pretest`);
  await page.getByRole('button', { name: /Mulai \/ lanjutkan pretest/ }).click();
  await expect(page).toHaveURL(/\/kuis\/kerjakan\//);
  const id = page.url().split('/').pop();
  const record = await page.evaluate(async (id) => (await fetch(`/api/assessments/${id}`)).json(), id);
  const index = record.questions.findIndex((q) => pattern.test([q.text, ...q.options].join(' ')));
  expect(index).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: `Ke soal ${index + 1}`, exact: true }).click();
  await expect(page.locator('.question-card h2 .katex').first()).toBeVisible();
}

/** Visible text without the screen-reader copies, plus geometry checks for every formula. */
function inspect(page, selector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    const clone = root.cloneNode(true);
    clone.querySelectorAll('.sr-only').forEach((node) => node.remove());
    const clipped = [...root.querySelectorAll('.katex')].filter((formula) => {
      const box = formula.getBoundingClientRect();
      const host = formula.closest('button, h2, h3, p, li, div').getBoundingClientRect();
      return box.right > host.right + 1 || box.left < host.left - 1;
    }).length;
    return {
      text: clone.innerText,
      formulas: root.querySelectorAll('.katex').length,
      clipped,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  }, selector);
}

test('quiz questions, options and review typeset fractions, inverses and matrices without raw LaTeX', async ({
  page,
}) => {
  await register(page, 'rumus-kuis');
  await openQuestion(page, 'fungsi', /\(x − 6\)\/2/);
  await expect(page.locator('.answer-options .katex .mfrac')).toHaveCount(3);
  let view = await inspect(page, '.question-card');
  expect(view.text).not.toMatch(/\\[a-z]+|\$|\(x − 6\)\/2/);
  expect(view.text).toContain('Invers dari');
  expect(view.clipped).toBe(0);
  // Options stay native buttons: keyboard selection and accessible names still work.
  const option = page.getByRole('radio', { name: /\(x − 6\)\/2/ });
  await option.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText('Tersimpan di server')).toBeVisible();
  await expect(option).toHaveAttribute('aria-checked', 'true');

  await openQuestion(page, 'aljabar', /\[\[1, 2, 3\], \[4, 5, 6\]\]/);
  await expect(page.locator('.question-card h2 .katex .mtable')).toHaveCount(1);
  view = await inspect(page, '.question-card');
  expect(view.text).not.toMatch(/\[\[|\\begin|bmatrix/);
  expect(view.clipped).toBe(0);
  await page.setViewportSize({ width: 360, height: 800 });
  view = await inspect(page, '.question-card');
  expect(view.overflow).toBe(false);
  expect(view.clipped).toBe(0);
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Explanations after submission: roots and powers.
  await page.goto('/kuis?subject=geometri&mode=pretest');
  await page.getByRole('button', { name: /Mulai \/ lanjutkan pretest/ }).click();
  for (let i = 0; i < 15; i++) {
    await page.getByRole('button', { name: `Ke soal ${i + 1}`, exact: true }).click();
    await page.getByRole('radio').nth(i % 4).click();
    await expect(page.getByText('Tersimpan di server')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Kumpulkan asesmen', exact: true }).click();
  await page.getByRole('button', { name: 'Ya, kumpulkan' }).click();
  await expect(page).toHaveURL(/\/kuis\/hasil\//);
  await page.getByRole('button', { name: 'Buka pembahasan' }).click();
  await expect(page.locator('.review-explanation .katex .sqrt').first()).toBeVisible();
  view = await inspect(page, '.review-list');
  expect(view.text).not.toMatch(/\\[a-z]+|\$|√\(/);
  expect(view.clipped).toBe(0);
});

test('tutor Markdown renders math and drops HTML, scripts and javascript links from model output', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Siswa', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const message = [
    '## Langkah',
    '**Contoh:** Diketahui f(x) = 3x + 1 dan $g(x) = \\frac{x}{2}$, maka (f ∘ g)(x) = 3x/2 + 1.',
    '\\[\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}\\]',
    'Akar: √(13² − 5²) = 12 dan \\(x^{2}\\).',
    '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script><b onclick="window.__xss=5">tebal</b>',
    '[tautan](javascript:window.__xss=3) ![gambar](https://example.invalid/x.png) $\\href{javascript:window.__xss=4}{klik}$',
  ].join('\n');
  await page.route('**/api/assistant', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message, fallback: false }) }),
  );
  await page.goto('/materi/geometri');
  await page.getByRole('textbox', { name: 'Pertanyaan pendamping belajar' }).fill('Contoh rumus');
  await page.getByRole('button', { name: 'Kirim pertanyaan' }).click();
  const bubble = page.locator('.chat-bubble.assistant .formatted-message').last();
  await expect(bubble.locator('.katex').first()).toBeVisible();
  await expect(bubble.locator('.katex-display .mtable')).toHaveCount(1);
  expect(await bubble.locator('.katex').count()).toBeGreaterThanOrEqual(6);
  await expect(bubble.locator('h2')).toHaveText('Langkah');
  await expect(bubble.locator('strong').first()).toHaveText('Contoh:');
  await expect(bubble.locator('img, script, b[onclick], [onerror], [onclick]')).toHaveCount(0);
  for (const href of await bubble.locator('a').evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? '')))
    expect(href).not.toMatch(/^javascript:/i);
  const text = await bubble.innerText();
  expect(text).not.toMatch(/\\frac|\\begin|\\\[|\\\(|\$|\*\*|##/);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});
