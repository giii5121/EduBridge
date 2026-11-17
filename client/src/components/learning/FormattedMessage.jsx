import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkAutoMath, { normalizeDelimiters } from '../../lib/remarkAutoMath';
import { KATEX_OPTIONS } from '../../lib/mathText';
import './katexRuntime';
import './FormattedMessage.css';

// AI output is untrusted: raw HTML is dropped (skipHtml), images are not rendered, links keep
// react-markdown's safe URL filter and open without opener access, and KaTeX runs with
// trust:false so \href/\url/\html* commands cannot create links or attributes.
const katexOptions = { ...KATEX_OPTIONS, throwOnError: false, errorColor: 'currentColor' };
const components = {
  img: () => null,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
};

export default function FormattedMessage({ text }) {
  return (
    <div className="formatted-message">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, remarkAutoMath]}
        rehypePlugins={[[rehypeKatex, katexOptions]]}
        skipHtml
        components={components}
      >
        {normalizeDelimiters(text)}
      </Markdown>
    </div>
  );
}
