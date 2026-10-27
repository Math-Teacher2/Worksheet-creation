// 브라우저에서만 실행됩니다.
// PDF를 "페이지 이미지 + 텍스트"로 바꿔서 AI에게 보낼 준비를 합니다.
// (수학 교재는 글자만 뽑으면 수식·그래프가 사라지므로, 페이지 이미지가 핵심입니다.)

let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      // postinstall 스크립트가 public/ 으로 복사해 둔 워커 파일
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function openPdf(file) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

// "1-3, 7, 10-12" -> [1,2,3,7,10,11,12]
export function parsePageRange(input, total) {
  const all = Array.from({ length: total }, (_, i) => i + 1);
  if (!input || !input.trim()) return all;
  const set = new Set();
  for (const part of input.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/);
    if (!m) continue;
    const a = Math.max(1, parseInt(m[1], 10));
    const b = Math.min(total, parseInt(m[2] || m[1], 10));
    for (let p = a; p <= b; p++) set.add(p);
  }
  const list = [...set].sort((x, y) => x - y);
  return list.length ? list : all;
}

export async function getPageCount(file) {
  if (!file || !file.type || !file.type.includes('pdf')) return 1;
  const pdf = await openPdf(file);
  return pdf.numPages;
}

async function renderPage(pdf, p, maxWidth, quality) {
  const page = await pdf.getPage(p);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, maxWidth / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const text = (await page.getTextContent()).items
    .map((it) => it.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    mime: 'image/jpeg',
    data: canvas.toDataURL('image/jpeg', quality).split(',')[1],
    text,
    page: p,
  };
}

const sizeOf = (images) => images.reduce((n, im) => n + im.data.length, 0);

// 전체 전송량(base64 문자 수)이 한도를 넘으면 해상도를 낮춰 다시 만듭니다.
async function renderMany(pdf, pages, tiers, budget, onProgress) {
  let images = [];
  for (const [maxWidth, quality] of tiers) {
    images = [];
    for (let i = 0; i < pages.length; i++) {
      images.push(await renderPage(pdf, pages[i], maxWidth, quality));
      if (onProgress) onProgress(i + 1, pages.length);
    }
    if (sizeOf(images) <= budget) break;
  }
  return images;
}

async function imageFileToPart(file, maxWidth, quality) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(bitmap.width * scale);
  canvas.height = Math.floor(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return {
    mime: 'image/jpeg',
    data: canvas.toDataURL('image/jpeg', quality).split(',')[1],
    text: '',
    page: 1,
  };
}

// 양식 참고용 파일(PDF/이미지) -> { images }
// pageRange를 비우면 앞쪽 4쪽만 사용합니다. (보통 1~2차시 분량이면 양식 파악에 충분)
export async function prepareTemplate(file, pageRange, onProgress) {
  if (file.type.startsWith('image/')) {
    return { images: [await imageFileToPart(file, 1400, 0.8)], pages: [1] };
  }
  const pdf = await openPdf(file);
  const pages = pageRange && pageRange.trim()
    ? parsePageRange(pageRange, pdf.numPages).slice(0, 8)
    : Array.from({ length: Math.min(pdf.numPages, 4) }, (_, i) => i + 1);
  const images = await renderMany(
    pdf,
    pages,
    [
      [1300, 0.8],
      [1000, 0.7],
    ],
    6_000_000,
    onProgress
  );
  return { images, pages };
}

// 교과서 PDF -> { images, pageCount, pages }
export async function prepareSource(file, pageRange, onProgress) {
  const pdf = await openPdf(file);
  const pages = parsePageRange(pageRange, pdf.numPages).slice(0, 30);
  const images = await renderMany(
    pdf,
    pages,
    [
      [1000, 0.72],
      [850, 0.65],
      [700, 0.6],
    ],
    11_000_000,
    onProgress
  );
  return { images, pageCount: pdf.numPages, pages };
}
