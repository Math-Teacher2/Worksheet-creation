'use client';

import { useEffect, useMemo, useRef } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { sanitizeHtml } from '../lib/sanitize';
import { renderPlotsIn } from '../lib/plot';

export default function WorksheetView({ html, showAnswers }) {
  const ref = useRef(null);
  const clean = useMemo(() => sanitizeHtml(html || ''), [html]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    renderPlotsIn(el);
    renderMathInElement(el, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$$', right: '$$', display: true },
      ],
      throwOnError: false,
      strict: 'ignore',
    });
  }, [clean]);

  return (
    <div
      ref={ref}
      className={`wsdoc ${showAnswers ? '' : 'hide-answers'}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
