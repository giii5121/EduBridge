// Presentation-layer math formatting: lossless, valid KaTeX, prose-preserving and safe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { initialTopics } from '../src/content.js';
import { KATEX_OPTIONS, segmentMath, toTex, plainMarkdown } from '../../client/src/lib/mathText.js';
import { expandText, normalizeDelimiters } from '../../client/src/lib/remarkAutoMath.js';

const render = (tex) => katex.renderToString(tex, KATEX_OPTIONS);
const mathOf = (text, options) =>
  segmentMath(text, options)
    .filter((s) => s.type === 'math')
    .map((s) => s.tex);

function allStrings() {
  const out = [];
  const walk = (value) => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  for (const topic of initialTopics) {
    for (const mode of ['pre', 'post'])
      for (const q of topic[mode]) out.push(q.text, q.explanation, ...q.options);
    walk(topic.blocks);
  }
  return out;
}

test('every question, option, explanation and lesson string typesets without KaTeX errors and losslessly', () => {
  const strings = allStrings();
  assert.ok(strings.length > 1000);
  let typeset = 0;
  for (const text of strings) {
    const segments = segmentMath(text);
    // The original instrument text is fully recoverable: formatting is presentation-only.
    assert.equal(segments.map((s) => (s.type === 'math' ? s.raw : s.value)).join(''), text);
    for (const s of segments.filter((x) => x.type === 'math')) {
      assert.doesNotThrow(() => render(s.tex), `${text} → ${s.tex}`);
      assert.doesNotMatch(s.raw, /\b(dan|adalah|berapa|yang|sehingga|maka)\b/i, `prose in math: ${s.raw}`);
      typeset++;
    }
  }
  assert.ok(typeset > 1000, `expected widespread notation, got ${typeset}`);
});

test('answer options typeset as one expression, including plain numbers and units', () => {
  for (const topic of initialTopics)
    for (const q of [...topic.pre, ...topic.post])
      for (const option of q.options) {
        const segments = segmentMath(option, { whole: true });
        if (/^[A-Za-z]{3,}/.test(option)) continue; // verbal options such as "Median"
        assert.ok(segments.some((s) => s.type === 'math'), option);
        segments.filter((s) => s.type === 'math').forEach((s) => render(s.tex));
      }
});

test('fractions, roots, powers, composition, inverse and matrices become structured TeX', () => {
  assert.deepEqual(mathOf('(x − 6)/2', { whole: true }), ['\\frac{x - 6}{2}']);
  assert.deepEqual(mathOf('Dengan π = 22/7, panjang busurnya …'), ['\\pi = \\frac{22}{7}']);
  assert.deepEqual(mathOf('√(13² − 5²) = √144 = 12 cm.'), [
    '\\sqrt{{13}^{2} - {5}^{2}} = \\sqrt{144} = 12 \\,\\text{cm}',
  ]);
  assert.deepEqual(mathOf('Jika f(x) = 3x − 9, berapakah f⁻¹(6)?'), ['f(x) = 3 x - 9', '{f}^{-1}(6)']);
  assert.deepEqual(mathOf('Bentuk (f ∘ g)(x) adalah …'), ['(f \\circ g)(x)']);
  assert.deepEqual(mathOf('Determinan [[2, 1], [3, 4]] adalah …'), [
    '\\begin{bmatrix} 2 & 1 \\\\ 3 & 4 \\end{bmatrix}',
  ]);
  assert.deepEqual(mathOf('[[2, 0], [0, 1/2]]', { whole: true }), [
    '\\begin{bmatrix} 2 & 0 \\\\ 0 & \\frac{1}{2} \\end{bmatrix}',
  ]);
  assert.deepEqual(mathOf('P(A ∩ B) = 0,2 dan P(A | B) = …'), ['P(A \\cap B) = 0{,}2', 'P(A \\mid B) = \\ldots']);
  assert.equal(toTex('20 × (1/2)²'), '20 \\times \\left( \\frac{1}{2} \\right)^{2}');
  assert.equal(toTex('Aᵀ'), '{A}^{T}');
});

test('Indonesian prose, lists, hyphenated words and dates stay as normal text', () => {
  for (const text of [
    'Rata-rata data 4, 6, 8, 10, 12 adalah …',
    'Mean memakai seluruh besar nilai sehingga peka terhadap outlier.',
    'Nilai tengah data terurut adalah data ke-3, yaitu 6.',
    'Laporan dibuat 2026-11-17 untuk Siswa-67ff4824.',
    'Kamu menguasai 2 konsep dengan estimasi 85%.',
  ])
    assert.deepEqual(segmentMath(text), [{ type: 'text', value: text }], text);
  const range = segmentMath('Jangkauan = nilai maksimum − minimum = 13 − 2 = 11.');
  assert.equal(range[0].value, 'Jangkauan = nilai maksimum − minimum ');
  assert.equal(range[1].tex, '= 13 - 2 = 11');
  // Brackets around words remain prose instead of breaking an expression.
  const conditional = segmentMath('gunakan P(merah pertama) × P(merah kedua | merah pertama).');
  assert.ok(conditional.filter((s) => s.type === 'text').some((s) => s.value.includes('(merah pertama)')));
});

test('explicit $…$, \\(…\\) and \\[…\\] are honoured and model delimiters are normalised', () => {
  const segments = segmentMath('Nilai $\\frac{1}{2}$ dan \\(x^2\\) serta $$x+1$$');
  assert.deepEqual(
    segments.filter((s) => s.type === 'math').map((s) => [s.tex, s.display]),
    [['\\frac{1}{2}', false], ['x^2', false], ['x+1', true]],
  );
  assert.equal(normalizeDelimiters('a \\(x^2\\) b'), 'a $x^2$ b');
  assert.match(normalizeDelimiters('\\[\\frac{1}{2}\\]'), /\$\$\n\\frac\{1\}\{2\}\n\$\$/);
  assert.equal(plainMarkdown('**Contoh:** $\\frac{1}{2}$ dan `kode`'), 'Contoh: 1/2 dan kode');
});

test('KaTeX output cannot carry links, scripts or HTML from untrusted text', () => {
  const html = render('\\href{javascript:alert(1)}{x} + \\url{javascript:alert(2)}');
  assert.doesNotMatch(html, /href=|javascript:/i);
  for (const command of ['\\htmlClass{x}{y}', '\\htmlId{x}{y}', '\\htmlStyle{color:red}{y}', '\\htmlData{a=b}{y}']) {
    assert.doesNotMatch(render(command), /class="x"|id="x"|style="color:red"|data-a/);
  }
  assert.doesNotMatch(render('\\text{<script>alert(1)</script>}'), /<script/i);
  // HTML-looking input is never treated as math and is rendered by React as escaped text.
  const injected = '<img src=x onerror=alert(1)> <script>alert(1)</script>';
  for (const s of segmentMath(injected)) {
    if (s.type === 'math') assert.doesNotMatch(render(s.tex), /<img|<script|onerror/i);
  }
  // Remark expansion yields only text, break and inlineMath nodes: no raw HTML nodes.
  const nodes = expandText('f(x) = 2x + 1\n<b onclick=alert(1)>tebal</b>');
  assert.ok(nodes.every((n) => ['text', 'break', 'inlineMath'].includes(n.type)));
  assert.equal(nodes.find((n) => n.type === 'inlineMath').value, 'f(x) = 2 x + 1');
});
