import { Fragment, useMemo, useSyncExternalStore } from 'react';
import { KATEX_OPTIONS, plainMath, segmentMath } from '../../lib/mathText';
import './MathText.css';

// KaTeX loads once in the background; until it arrives the original Unicode text is shown,
// which is readable on its own (never LaTeX source).
let katex = null;
const listeners = new Set();
import('./katexRuntime')
  .then((module) => {
    katex = module.default;
    listeners.forEach((listener) => listener());
  })
  .catch(() => {});
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => katex;

const cache = new Map();
function typeset(tex, display) {
  const key = `${display ? 'D' : 'I'}${tex}`;
  if (cache.has(key)) return cache.get(key);
  let html = null;
  try {
    // trust:false blocks \href, \url, \includegraphics and \html* commands; KaTeX escapes text.
    html = katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode: display });
  } catch {
    html = null;
  }
  if (cache.size > 1000) cache.clear();
  cache.set(key, html);
  return html;
}

/**
 * Inline text with typeset math. `whole` is for strings that are only math, such as an answer
 * option; it typesets plain numbers too so all options share one typeface.
 */
export default function MathText({ text, whole = false, className = '' }) {
  const engine = useSyncExternalStore(subscribe, snapshot, snapshot);
  const segments = useMemo(() => segmentMath(text, { whole }), [text, whole]);
  return (
    <span className={`math-text ${className}`.trim()}>
      {segments.map((segment, i) => {
        if (segment.type === 'text') return <Fragment key={i}>{segment.value}</Fragment>;
        const readable = segment.authored ? segment.tex : plainMath(segment);
        const tex = segment.forced ? `\\displaystyle ${segment.tex}` : segment.tex;
        const html = engine ? typeset(tex, segment.display) : null;
        if (!html)
          return (
            <span key={i} className="math-fallback">
              {readable}
            </span>
          );
        return (
          <span key={i} className={segment.display ? 'math-display' : 'math-inline'}>
            <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
            <span className="sr-only">{readable}</span>
          </span>
        );
      })}
    </span>
  );
}
