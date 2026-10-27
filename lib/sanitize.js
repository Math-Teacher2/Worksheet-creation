// AI가 만든 HTML에서 위험한 요소(스크립트 등)를 제거합니다. 브라우저에서만 사용.

const BLOCKED_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input',
  'button', 'textarea', 'select', 'img', 'video', 'audio', 'source', 'foreignobject', 'style',
]);

export function stripFences(text) {
  return String(text || '')
    .replace(/^\s*```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${stripFences(html)}</body>`, 'text/html');

  const walk = (node) => {
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase();
      if (BLOCKED_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        if (name.startsWith('on')) child.removeAttribute(attr.name);
        else if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(value))
          child.removeAttribute(attr.name);
        else if (name === 'style' && /(url\(|expression\(|javascript:|@import)/i.test(value))
          child.removeAttribute(attr.name);
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
