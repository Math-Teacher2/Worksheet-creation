// 학습지용 그래프(SVG) 렌더러.
// AI가 좌표를 직접 그리는 대신 "그래프 명세(JSON)"만 쓰면, 여기서 정확하게 그려 줍니다.
//
// 명세 예:
// {
//   "xmin": -2, "xmax": 3, "ymin": -1, "ymax": 4,
//   "curves": [{ "expr": "x+1", "from": -2, "to": 3 }],
//   "points": [{ "x": 1, "y": 2, "open": true }],
//   "guides": [{ "x": 1, "y": 2 }],
//   "ticks": { "x": [1], "y": [1, 2] },
//   "labels": [{ "x": 2, "y": 3.2, "text": "y=f(x)" }]
// }

const COLOR = '#e0457b';
let plotCounter = 0;

const FUNCS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
};
const CONSTS = { pi: Math.PI, e: Math.E };

// "x^2-2x+1", "(x^2-1)/(x-1)", "-x^2", "2^(-x)", "sqrt(x+1)" 같은 식을
// eval 없이 직접 파싱해서 함수로 바꿉니다. (보안상 안전)
export function compileExpr(expr) {
  if (typeof expr !== 'string' || expr.length > 200) return null;
  const src = expr
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .toLowerCase();

  const tokens = [];
  const re = /(\d+\.?\d*|\.\d+)|([a-z]+)|([+\-*/^(),])/y;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) return null;
    if (m[1] !== undefined) tokens.push({ t: 'num', v: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: 'name', v: m[2] });
    else tokens.push({ t: 'op', v: m[3] });
    pos = re.lastIndex;
  }

  let i = 0;
  const peek = () => tokens[i];
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
  const startsPrimary = () => {
    const k = peek();
    return !!k && (k.t === 'num' || k.t === 'name' || (k.t === 'op' && k.v === '('));
  };

  function parseExpr() {
    let left = parseTerm();
    while (isOp('+') || isOp('-')) {
      const op = tokens[i++].v;
      const right = parseTerm();
      const l = left;
      left = op === '+' ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }
  function parseTerm() {
    let left = parseUnary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = tokens[i++].v;
        const right = parseUnary();
        const l = left;
        left = op === '*' ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
      } else if (startsPrimary()) {
        // 암묵적 곱셈: 2x, 2(x+1), x(x-1), (x+1)(x-1)
        const right = parsePower();
        const l = left;
        left = (x) => l(x) * right(x);
      } else break;
    }
    return left;
  }
  function parseUnary() {
    if (isOp('-')) {
      i++;
      const f = parseUnary();
      return (x) => -f(x);
    }
    if (isOp('+')) {
      i++;
      return parseUnary();
    }
    return parsePower();
  }
  function parsePower() {
    const base = parsePrimary();
    if (isOp('^')) {
      i++;
      const exp = parseUnary(); // 오른쪽 결합, 2^-x 허용
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }
  function parsePrimary() {
    const k = tokens[i++];
    if (!k) throw new Error('unexpected end');
    if (k.t === 'num') return () => k.v;
    if (k.t === 'op' && k.v === '(') {
      const f = parseExpr();
      if (!isOp(')')) throw new Error('missing )');
      i++;
      return f;
    }
    if (k.t === 'name') {
      if (k.v === 'x') return (x) => x;
      if (Object.prototype.hasOwnProperty.call(CONSTS, k.v)) return () => CONSTS[k.v];
      if (Object.prototype.hasOwnProperty.call(FUNCS, k.v)) {
        if (!isOp('(')) throw new Error('function needs (');
        i++;
        const arg = parseExpr();
        if (!isOp(')')) throw new Error('missing )');
        i++;
        const fn = FUNCS[k.v];
        return (x) => fn(arg(x));
      }
    }
    throw new Error('bad token');
  }

  try {
    const f = parseExpr();
    if (i !== tokens.length) return null;
    if (typeof f(1) !== 'number') return null;
    return f;
  } catch {
    return null;
  }
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const esc = (t) =>
  String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderPlot(spec) {
  const id = `pl${++plotCounter}`;
  const W = num(spec.w, 260);
  const H = num(spec.h, 210);
  const xmin = num(spec.xmin, -3);
  const xmax = num(spec.xmax, 3);
  const ymin = num(spec.ymin, -3);
  const ymax = num(spec.ymax, 3);
  if (!(xmax > xmin) || !(ymax > ymin)) return '';

  const L = 22, R = 16, T = 14, B = 20;
  const pw = W - L - R;
  const ph = H - T - B;
  const X = (x) => L + ((x - xmin) / (xmax - xmin)) * pw;
  const Y = (y) => T + (1 - (y - ymin) / (ymax - ymin)) * ph;

  // 축 위치: 0이 범위 안이면 0, 아니면 가장자리
  const ax = xmin <= 0 && xmax >= 0 ? 0 : xmin;
  const ay = ymin <= 0 && ymax >= 0 ? 0 : ymin;
  const ox = X(ax);
  const oy = Y(ay);

  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" class="plot-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="serif" font-size="11">`
  );
  out.push(`<defs><clipPath id="${id}"><rect x="${L}" y="${T}" width="${pw}" height="${ph}"/></clipPath></defs>`);

  // 보조선(수평/수직)
  for (const h of spec.hlines || []) {
    const y = num(h.y, null);
    if (y === null) continue;
    out.push(
      `<line x1="${L}" y1="${Y(y)}" x2="${L + pw}" y2="${Y(y)}" stroke="#333" stroke-width="1" ${
        h.dash === false ? '' : 'stroke-dasharray="3 3"'
      }/>`
    );
  }
  for (const v of spec.vlines || []) {
    const x = num(v.x, null);
    if (x === null) continue;
    out.push(
      `<line x1="${X(x)}" y1="${T}" x2="${X(x)}" y2="${T + ph}" stroke="#333" stroke-width="1" ${
        v.dash === false ? '' : 'stroke-dasharray="3 3"'
      }/>`
    );
  }

  // 축
  out.push(`<line x1="${L - 4}" y1="${oy}" x2="${L + pw + 6}" y2="${oy}" stroke="#000" stroke-width="1"/>`);
  out.push(`<line x1="${ox}" y1="${T + ph + 4}" x2="${ox}" y2="${T - 6}" stroke="#000" stroke-width="1"/>`);
  out.push(`<path d="M${L + pw + 6},${oy} l-5,-3 l0,6 z" fill="#000"/>`);
  out.push(`<path d="M${ox},${T - 6} l-3,5 l6,0 z" fill="#000"/>`);
  out.push(`<text x="${L + pw + 4}" y="${oy + 14}" font-style="italic">${esc(spec.xname || 'x')}</text>`);
  out.push(`<text x="${ox - 12}" y="${T - 2}" font-style="italic">${esc(spec.yname || 'y')}</text>`);
  if (ax === 0 && ay === 0) out.push(`<text x="${ox - 11}" y="${oy + 12}">O</text>`);

  // 눈금 숫자
  for (const t of (spec.ticks && spec.ticks.x) || []) {
    if (typeof t !== 'number' || t === 0) continue;
    out.push(`<line x1="${X(t)}" y1="${oy - 2}" x2="${X(t)}" y2="${oy + 2}" stroke="#000"/>`);
    out.push(`<text x="${X(t)}" y="${oy + 13}" text-anchor="middle">${t}</text>`);
  }
  for (const t of (spec.ticks && spec.ticks.y) || []) {
    if (typeof t !== 'number' || t === 0) continue;
    out.push(`<line x1="${ox - 2}" y1="${Y(t)}" x2="${ox + 2}" y2="${Y(t)}" stroke="#000"/>`);
    out.push(`<text x="${ox - 5}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`);
  }

  // 점선 가이드 (점 → 축)
  for (const g of spec.guides || []) {
    const gx = num(g.x, null);
    const gy = num(g.y, null);
    if (gx === null || gy === null) continue;
    out.push(`<line x1="${X(gx)}" y1="${Y(gy)}" x2="${X(gx)}" y2="${oy}" stroke="#555" stroke-dasharray="2 3"/>`);
    out.push(`<line x1="${X(gx)}" y1="${Y(gy)}" x2="${ox}" y2="${Y(gy)}" stroke="#555" stroke-dasharray="2 3"/>`);
  }

  // 곡선
  for (const c of spec.curves || []) {
    const fn = compileExpr(c.expr);
    if (!fn) continue;
    const from = num(c.from, xmin);
    const to = num(c.to, xmax);
    const N = 360;
    const span = ymax - ymin;
    let d = '';
    let prevY = null;
    let pen = false;
    for (let i = 0; i <= N; i++) {
      const x = from + ((to - from) * i) / N;
      let y;
      try {
        y = fn(x);
      } catch {
        y = NaN;
      }
      const bad = !Number.isFinite(y) || y > ymax + span || y < ymin - span;
      if (bad || (prevY !== null && Math.abs(y - prevY) > span * 0.9)) {
        pen = false;
        prevY = bad ? null : y;
        if (bad) continue;
      }
      d += `${pen ? 'L' : 'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)} `;
      pen = true;
      prevY = y;
    }
    if (d) {
      out.push(
        `<path d="${d}" fill="none" stroke="${esc(c.color || COLOR)}" stroke-width="1.6" clip-path="url(#${id})" ${
          c.dash ? 'stroke-dasharray="4 3"' : ''
        }/>`
      );
    }
  }

  // 점들을 이은 점선 (수열 그래프)
  const pts = (spec.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (spec.connect && pts.length > 1) {
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)}`).join(' ');
    out.push(
      `<path d="${d}" fill="none" stroke="${COLOR}" stroke-width="1.6" stroke-dasharray="2 3" clip-path="url(#${id})"/>`
    );
  }

  // 점 (open=true면 속이 빈 점)
  for (const p of pts) {
    out.push(
      `<circle cx="${X(p.x).toFixed(2)}" cy="${Y(p.y).toFixed(2)}" r="2.8" fill="${
        p.open ? '#fff' : '#000'
      }" stroke="#000" stroke-width="1"/>`
    );
    if (p.label) {
      out.push(`<text x="${X(p.x) + 5}" y="${Y(p.y) - 5}" font-size="10">${esc(p.label)}</text>`);
    }
  }

  // 글자 라벨
  for (const l of spec.labels || []) {
    if (!Number.isFinite(l.x) || !Number.isFinite(l.y) || !l.text) continue;
    out.push(`<text x="${X(l.x)}" y="${Y(l.y)}" font-style="italic" font-size="11">${esc(l.text)}</text>`);
  }

  out.push('</svg>');
  return out.join('');
}

// 컨테이너 안의 <div class="plot" data-spec='{...}'> 를 모두 SVG로 바꿉니다.
export function renderPlotsIn(root) {
  root.querySelectorAll('.plot[data-spec]').forEach((el) => {
    try {
      const spec = JSON.parse(el.getAttribute('data-spec'));
      const svg = renderPlot(spec);
      el.innerHTML = svg || '<span class="plot-err">(그래프 범위 오류)</span>';
    } catch {
      el.innerHTML = '<span class="plot-err">(그래프를 그리지 못했습니다)</span>';
    }
  });
}
