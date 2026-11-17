// remark plugin: typeset plain Unicode notation in Markdown (tutor and narrative output) and
// keep the model's single line breaks. Explicit $…$ math is already parsed by remark-math.
import { segmentMath } from './mathText.js';

const SKIP = new Set(['link', 'linkReference', 'inlineCode', 'code', 'inlineMath', 'math', 'html']);

function mathNode(tex) {
  return {
    type: 'inlineMath',
    value: tex,
    data: {
      hName: 'code',
      hProperties: { className: ['language-math', 'math-inline'] },
      hChildren: [{ type: 'text', value: tex }],
    },
  };
}

export function expandText(value) {
  const out = [];
  value.split('\n').forEach((line, index) => {
    if (index) out.push({ type: 'break' });
    for (const segment of segmentMath(line)) {
      if (segment.type === 'math') out.push(mathNode(segment.tex));
      else if (segment.value) out.push({ type: 'text', value: segment.value });
    }
  });
  return out;
}

function walk(node) {
  if (!node.children || SKIP.has(node.type)) return;
  const next = [];
  for (const child of node.children) {
    if (child.type === 'text') next.push(...expandText(child.value));
    else {
      walk(child);
      next.push(child);
    }
  }
  node.children = next;
}

export default function remarkAutoMath() {
  return (tree) => walk(tree);
}

/** Accept \( … \) and \[ … \] from the model, which remark-math does not parse. */
export function normalizeDelimiters(text) {
  return String(text ?? '')
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => `\n$$\n${tex.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => `$${tex.trim()}$`);
}
