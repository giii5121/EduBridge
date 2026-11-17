// Presentation-only math formatter.
// Instrument text (question bank, keys, snapshots, fingerprints) stays untouched; this module
// only decides how existing Unicode notation such as "(x − 6)/2", "√(13² − 5²)", "f⁻¹(6)" or
// "[[2, 1], [3, 4]]" is typeset. Indonesian prose remains plain text. Output TeX is built from
// a small whitelist of commands, so it never carries HTML or KaTeX "trust" features.

const SUP = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8',
  '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n', 'ᵀ': 'T', 'ᶜ': 'c',
};
const SUB = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8',
  '₉': '9', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₙ': 'n',
};
const VULGAR = {
  '½': '\\frac{1}{2}', '¼': '\\frac{1}{4}', '¾': '\\frac{3}{4}', '⅓': '\\frac{1}{3}',
  '⅔': '\\frac{2}{3}',
};
const OPS = {
  '+': '+', '−': '-', '×': '\\times', '÷': '\\div', '·': '\\cdot', '=': '=', '≠': '\\neq',
  '≈': '\\approx', '≤': '\\le', '≥': '\\ge', '<': '<', '>': '>', '∘': '\\circ', '∪': '\\cup',
  '∩': '\\cap', '→': '\\to', '±': '\\pm', '∈': '\\in',
};
const SYMBOLS = {
  'π': '\\pi', 'θ': '\\theta', 'α': '\\alpha', 'β': '\\beta', 'λ': '\\lambda', 'σ': '\\sigma',
  'μ': '\\mu', 'Σ': '\\Sigma', '∞': '\\infty', '∠': '\\angle',
};
const FUNCS = new Set(['det', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'lim', 'max', 'min']);
const UNITS = new Set(['cm', 'mm', 'km', 'kg']);
const SHORT_WORDS = new Set(['di', 'ke', 'ia', 'ya', 'se', 'oh', 'ok', 'tv', 'hp', 'pr', 'ii']);
const CLOSER = { '(': ')', '[': ']', '{': '}' };
// Kinds whose presence turns a run into typeset math. Plain numbers, units and percentages
// alone stay as prose so "15 soal" or "85%" in a sentence does not change typeface.
const QUALIFIES = new Set(['op', 'slash', 'sqrt', 'sym', 'frac', 'matrix', 'tex', 'func', 'var', 'sup']);
const OPERAND = new Set(['num', 'var', 'sym', 'frac', 'matrix', 'tex', 'func', 'ell']);
const MATHY = new Set([
  'num', 'var', 'op', 'open', 'close', 'slash', 'sqrt', 'post', 'sup', 'sym', 'frac', 'matrix',
  'tex', 'unit', 'func', 'comma', 'ell',
]);

const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿ';
const RE = {
  space: /[ \t ]+/y,
  tex: /\\[a-zA-Z]+(?:\{[^{}]*\})*/y,
  matrix: /\[\s*\[[^[\]]*\](?:\s*,\s*\[[^[\]]*\])*\s*\]/y,
  num: /\d+(?:,\d+)?(?:\.\d+)?/y,
  word: new RegExp(`[${LETTER}]+(?:-[${LETTER}0-9]+)*\\u0304?`, 'y'),
  sup: /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿᵀᶜ]+/y,
  sub: /[₀₁₂₃₄₅₆₇₈₉ᵢⱼₖₙ]+/y,
};

function match(re, s, i) {
  re.lastIndex = i;
  const m = re.exec(s);
  return m ? m[0] : null;
}

export function lex(s) {
  const tokens = [];
  let i = 0;
  const push = (k, raw, tex = raw, extra = {}) => {
    tokens.push({ k, raw, tex, start: i, ...extra });
    i += raw.length;
  };
  while (i < s.length) {
    const c = s[i];
    let m;
    if (c === '\n' || c === '\r') push('text', c);
    else if ((m = match(RE.space, s, i))) push('space', m, ' ');
    else if (c === '\\' && (m = match(RE.tex, s, i))) push('tex', m);
    else if (c === '[' && (m = match(RE.matrix, s, i))) push('matrix', m, matrixTex(m));
    else if ((m = match(RE.num, s, i))) push('num', m, m.replace(',', '{,}'));
    else if ((m = match(RE.word, s, i))) {
      const bar = m.endsWith('̄');
      const w = bar ? m.slice(0, -1) : m;
      const next = s[i + m.length];
      if (FUNCS.has(w) && next === '(') push('func', m, `\\${w}`);
      else if (UNITS.has(w)) push('unit', m, `\\,\\text{${w}}`);
      else if (w.length === 1) push('var', m, bar ? `\\bar{${w}}` : w);
      else if (/^[A-Za-z]+$/.test(w) && w.length <= 3 && /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ᵀᶜ₀₁₂₃₄₅₆₇₈₉′]/.test(next ?? ''))
        push('var', m, w);
      else push('word', m, w, { candidate: /^[A-Za-z]{2,3}$/.test(w) });
    } else if ((m = match(RE.sup, s, i))) push('sup', m, `^{${[...m].map((x) => SUP[x]).join('')}}`);
    else if ((m = match(RE.sub, s, i))) push('post', m, `_{${[...m].map((x) => SUB[x]).join('')}}`);
    else if (c === '°') push('sup', c, '^{\\circ}');
    else if (c === '′') push('post', c, "'");
    else if (c === '″') push('post', c, "''");
    else if (c === '%') push('post', c, '\\%');
    else if (c === '√') push('sqrt', c, '\\sqrt');
    else if (VULGAR[c]) push('frac', c, VULGAR[c]);
    else if (SYMBOLS[c]) push('sym', c, SYMBOLS[c] + ' ');
    else if (c === '…') push('ell', c, '\\ldots');
    else if (c === '(' || c === '[' || c === '{') push('open', c);
    else if (c === ')' || c === ']' || c === '}') push('close', c);
    else if (c === ',') push('comma', c, ',');
    else if (c === '/') push('slash', c);
    else if (c === '|') push('op', c, s[i - 1] === ' ' && s[i + 1] === ' ' ? '\\mid' : '|');
    else if (OPS[c]) push('op', c, OPS[c]);
    else if (c === '-') {
      // ASCII hyphen is a minus only in "= -6" or "(-3)", never inside words or dates.
      const prev = s[i - 1];
      const nextChar = s[i + 1] ?? '';
      const minus = (!prev || /[\s(=[+×]/.test(prev)) && /[\d(A-Za-z]/.test(nextChar);
      push(minus ? 'op' : 'text', c, '-');
    } else push('text', c);
  }
  // Short letter groups next to operators are variables ("ad − bc", "PA = 8 cm").
  const near = (j, step) => {
    for (let x = j + step; x >= 0 && x < tokens.length; x += step)
      if (tokens[x].k !== 'space') return tokens[x];
    return null;
  };
  tokens.forEach((t, j) => {
    if (t.k !== 'word' || !t.candidate) return;
    const around = [near(j, -1), near(j, 1)];
    if (around.some((n) => n && (n.k === 'op' || n.k === 'slash'))) t.k = 'var';
    // Two-letter products inside coordinates: (kx, ky). Indonesian short words stay prose.
    else if (
      /^[a-z]{2}$/.test(t.raw) &&
      !SHORT_WORDS.has(t.raw) &&
      around.some((n) => n && ['open', 'close', 'comma'].includes(n.k)) &&
      around.every((n) => !n || n.k !== 'word')
    )
      t.k = 'var';
  });
  // Point names after an angle sign: ∠ACB.
  tokens.forEach((t, j) => {
    if (t.k === 'word' && /^[A-Z]{2,4}$/.test(t.raw) && tokens[j - 1]?.raw === '∠') t.k = 'var';
  });
  return tokens;
}

function matrixTex(raw) {
  const rows = raw.slice(1, -1).match(/\[[^[\]]*\]/g) ?? [];
  const body = rows
    .map((row) =>
      row
        .slice(1, -1)
        .split(/,\s+/)
        .map((cell) => toTex(cell.trim()))
        .join(' & '),
    )
    .join(' \\\\ ');
  return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
}

// ---------- TeX conversion of a token run ----------
const PRIMARY = new Set(['num', 'var', 'sym', 'frac', 'matrix', 'tex', 'func', 'group', 'unit', 'sqrtd']);

function parseSeq(tokens, state, closer) {
  const seq = [];
  while (state.i < tokens.length) {
    const t = tokens[state.i];
    if (t.k === 'close') {
      if (closer === t.raw) return { seq, closed: true };
      seq.push({ k: 'raw', tex: t.raw === '}' ? '\\}' : t.raw });
      state.i++;
      continue;
    }
    if (t.k === 'open') {
      state.i++;
      const close = CLOSER[t.raw];
      const inner = parseSeq(tokens, state, close);
      if (inner.closed) {
        state.i++;
        seq.push({ k: 'group', open: t.raw, close, children: inner.seq, ws: t.ws });
      } else {
        seq.push({ k: 'raw', tex: t.raw === '{' ? '\\{' : t.raw }, ...inner.seq);
      }
      continue;
    }
    seq.push({ k: t.k, tex: t.tex, ws: t.ws });
    state.i++;
  }
  return { seq, closed: false };
}

function render(nodes) {
  // 1. postfixes (², °, ₂₁, ′, %) attach to the preceding node
  let out = [];
  for (const n of nodes) {
    if (n.k === 'group') n.tex = groupTex(n);
    const prev = out[out.length - 1];
    if ((n.k === 'post' || n.k === 'sup') && prev && prev.k !== 'op') {
      prev.tex = (prev.k === 'group' ? prev.tex : `{${prev.tex}}`) + n.tex;
      if (prev.k === 'group') prev.k = 'num';
      continue;
    }
    out.push(n);
  }
  // 2. square roots take the next primary
  nodes = out;
  out = [];
  for (let j = 0; j < nodes.length; j++) {
    const n = nodes[j];
    const next = nodes[j + 1];
    if (n.k === 'sqrt' && next && PRIMARY.has(next.k)) {
      const inner = next.k === 'group' && next.children ? renderInner(next.children) : next.tex;
      out.push({ k: 'sqrtd', tex: `\\sqrt{${inner}}`, ws: n.ws });
      j++;
    } else out.push(n);
  }
  // 3. juxtaposed primaries without spaces form one atom: 2x, 2πr, f(x), (f ∘ g)(x), det(A)
  nodes = out;
  out = [];
  for (const n of nodes) {
    const prev = out[out.length - 1];
    if (prev && !n.ws && PRIMARY.has(n.k) && PRIMARY.has(prev.k) && prev.k !== 'unit' && n.k !== 'unit') {
      prev.tex += n.k === 'group' || prev.k === 'func' ? n.tex : ` ${n.tex}`;
      prev.atom = true;
      prev.children = null;
      prev.k = 'num';
      continue;
    }
    out.push(n);
  }
  // 4. fractions: a/b with atoms on both sides
  nodes = out;
  out = [];
  for (let j = 0; j < nodes.length; j++) {
    const n = nodes[j];
    const prev = out[out.length - 1];
    const next = nodes[j + 1];
    if (n.k === 'slash' && prev && next && PRIMARY.has(prev.k) && PRIMARY.has(next.k)) {
      out[out.length - 1] = { k: 'frac', tex: `\\frac{${unwrap(prev)}}{${unwrap(next)}}`, ws: prev.ws };
      j++;
    } else out.push(n.k === 'slash' ? { ...n, tex: '/' } : n);
  }
  return out
    .map((n) => (n.k === 'sqrt' ? '\\surd' : n.tex))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderInner(children) {
  return render(children.map((c) => ({ ...c })));
}
function groupTex(n) {
  const inner = renderInner(n.children);
  const tall = /\\frac|\\begin|\\sqrt/.test(inner);
  const open = n.open === '{' ? '\\{' : n.open;
  const close = n.close === '}' ? '\\}' : n.close;
  return tall ? `\\left${open} ${inner} \\right${close}` : `${open}${inner}${close}`;
}
function unwrap(n) {
  if (n.k === 'group' && n.children) return renderInner(n.children);
  return n.tex;
}

/** Convert one run of math-like text to TeX. */
export function toTex(text) {
  const tokens = lex(text).map((t, j, all) => ({ ...t, ws: j > 0 && all[j - 1].k === 'space' }));
  const filtered = tokens.filter((t) => t.k !== 'space');
  // Words left inside a forced run (e.g. matrix cells) are shown upright as text.
  for (const t of filtered) if (t.k === 'word' || t.k === 'text') {
    t.k = 'tex';
    t.tex = `\\text{${t.raw.replace(/[\\{}$&#^_%~]/g, '')}}`;
  }
  return render(parseSeq(filtered, { i: 0 }).seq);
}

// ---------- segmentation of prose into text and math ----------
function segmentAuto(text, { whole = false } = {}) {
  const tokens = lex(text);
  const nonSpace = tokens.filter((t) => t.k !== 'space');
  if (whole && nonSpace.length && nonSpace.every((t) => MATHY.has(t.k))) {
    return [{ type: 'math', raw: text, tex: toTex(text.trim()), display: false, forced: true }];
  }
  const runs = [];
  let run = null;
  let depth = 0;
  const nextSolid = (j) => {
    for (let x = j + 1; x < tokens.length; x++) if (tokens[x].k !== 'space') return tokens[x];
    return null;
  };
  const prevSolid = (j) => {
    for (let x = j - 1; x >= 0; x--) if (tokens[x].k !== 'space') return tokens[x];
    return null;
  };
  const end = () => {
    if (run) runs.push(run);
    run = null;
    depth = 0;
  };
  tokens.forEach((t, j) => {
    let mathy = MATHY.has(t.k);
    if (t.k === 'space') mathy = Boolean(run);
    if (t.k === 'comma') {
      const next = nextSolid(j);
      mathy = Boolean(run) && (depth > 0 || (next && ['num', 'var', 'open', 'op', 'matrix'].includes(next.k)));
    }
    if (t.k === 'ell') {
      const prev = prevSolid(j);
      mathy = Boolean(prev && ['op', 'comma', 'open'].includes(prev.k));
    }
    if (!mathy) return end();
    if (!run) run = { from: j, to: j };
    run.to = j;
    if (t.k === 'open') depth++;
    if (t.k === 'close') depth = Math.max(0, depth - 1);
  });
  end();
  const segments = [];
  let cursor = 0;
  for (const r of runs) {
    // trim spaces, trailing commas and unmatched edge brackets
    let { from, to } = r;
    const trimmable = (t) => t.k === 'space' || t.k === 'comma';
    while (from <= to && trimmable(tokens[from])) from++;
    while (to >= from && trimmable(tokens[to])) to--;
    // "P(merah pertama) × P(…)": brackets whose partner lies in prose stay with the prose.
    const unmatched = new Set();
    const stack = [];
    for (let x = from; x <= to; x++) {
      const t = tokens[x];
      if (t.k === 'open') stack.push(x);
      else if (t.k === 'close') {
        const top = stack[stack.length - 1];
        if (top !== undefined && CLOSER[tokens[top].raw] === t.raw) stack.pop();
        else unmatched.add(x);
      }
    }
    stack.forEach((x) => unmatched.add(x));
    const edge = (t, x) => trimmable(t) || unmatched.has(x);
    while (from <= to && edge(tokens[from], from)) from++;
    while (to >= from && edge(tokens[to], to)) to--;
    const slice = tokens.slice(from, to + 1);
    if (!slice.length || !slice.some((t) => QUALIFIES.has(t.k) || (t.k === 'comma' && slice[0].k === 'open')))
      continue;
    // A lone operator between words ("maksimum − minimum") stays prose.
    if (!slice.some((t) => OPERAND.has(t.k))) continue;
    const start = slice[0].start;
    const last = slice[slice.length - 1];
    const stop = last.start + last.raw.length;
    if (start > cursor) segments.push({ type: 'text', value: text.slice(cursor, start) });
    const raw = text.slice(start, stop);
    segments.push({ type: 'math', raw, tex: toTex(raw), display: false });
    cursor = stop;
  }
  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  return segments;
}

const DELIMITED = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

/**
 * Split text into [{type:'text', value}] and [{type:'math', tex, raw, display}].
 * Explicit $…$, $$…$$, \(…\) and \[…\] are honoured; other notation is detected heuristically.
 * `whole` typesets a string that consists only of math (an answer option such as "8" or "(6, 2)").
 */
export function segmentMath(text, options = {}) {
  const value = String(text ?? '');
  const out = [];
  let cursor = 0;
  for (const m of value.matchAll(DELIMITED)) {
    if (m.index > cursor) out.push(...segmentAuto(value.slice(cursor, m.index)));
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim();
    out.push({ type: 'math', raw: m[0], tex, display: Boolean(m[1] || m[4]), authored: true });
    cursor = m.index + m[0].length;
  }
  if (cursor === 0) return segmentAuto(value, options);
  if (cursor < value.length) out.push(...segmentAuto(value.slice(cursor)));
  return out;
}

/** Readable fallback for screen readers and failed typesetting: the original text. */
export function plainMath(segment) {
  return segment.type === 'math' ? segment.raw.replace(/^\$+|\$+$/g, '') : segment.value;
}

export const KATEX_OPTIONS = Object.freeze({
  throwOnError: true,
  trust: false,
  strict: 'ignore',
  output: 'html',
  maxExpand: 200,
  maxSize: 20,
});

/** Plain-text placeholder while the Markdown/KaTeX renderer loads: no markup characters. */
export function plainMarkdown(text) {
  return String(text ?? '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\[()[\]]/g, '')
    .replace(/[*_#`$>]+/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '');
}
