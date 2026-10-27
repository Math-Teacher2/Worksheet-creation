// 브라우저에서 Gemini API를 직접 호출합니다. (서버를 거치지 않으므로 Vercel 시간 제한이 없고,
// 사용자의 API 키가 우리 서버로 전송되지 않습니다.)

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// 모델 후보: 앞에서부터 시도하고, "모델 없음/권한 없음"이면 다음 모델로 넘어갑니다.
export const MODEL_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

export class GeminiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function friendlyError(status, apiMessage, model) {
  const msg = apiMessage || '';
  if (status === 400 && /API key/i.test(msg)) return 'API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.';
  if (status === 400 && /maxOutputTokens|max_output_tokens/i.test(msg))
    return `이 모델(${model})은 출력 길이 설정을 지원하지 않습니다. 다른 모델로 바꿔 보세요.`;
  if (status === 401 || status === 403)
    return `API 키 권한 오류입니다. 키가 맞는지, 이 모델(${model})을 쓸 수 있는 키인지 확인해 주세요. (${msg})`;
  if (status === 404) return `모델(${model})을 찾을 수 없습니다.`;
  if (status === 429)
    return '입력하신 API 키의 무료 사용량 한도(분당/일일)에 도달했습니다. 1분쯤 뒤 다시 시도하거나, 내일 다시 사용해 주세요.';
  if (status === 503 || status === 500) return `Google 서버가 일시적으로 바쁩니다(${status}). 잠시 후 다시 시도해 주세요.`;
  return msg || `Gemini 호출 실패 (${status})`;
}

// SSE 한 덩어리("data: {...}")에서 텍스트와 종료 사유를 뽑습니다.
export function parseSseEvents(buffer) {
  const events = [];
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop(); // 아직 덜 온 조각
  for (const block of parts) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    if (!dataLines.length) continue;
    const payload = dataLines.join('');
    if (!payload || payload === '[DONE]') continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      // 깨진 조각은 무시
    }
  }
  return { events, rest };
}

async function streamOnce({ apiKey, model, systemPrompt, parts, maxOutputTokens, temperature, onText, signal }) {
  const url = `${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, maxOutputTokens },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new GeminiError(
      '네트워크 오류로 Gemini에 연결하지 못했습니다. 인터넷 연결(또는 광고 차단/보안 프로그램)을 확인해 주세요.',
      0,
      'network'
    );
  }

  if (!res.ok) {
    let apiMessage = '';
    try {
      const j = await res.json();
      apiMessage = j?.error?.message || '';
    } catch {}
    throw new GeminiError(friendlyError(res.status, apiMessage, model), res.status, 'http');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finishReason = '';
  let blockReason = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseEvents(buffer);
    buffer = rest;
    for (const ev of events) {
      if (ev?.error) throw new GeminiError(friendlyError(ev.error.code, ev.error.message, model), ev.error.code, 'stream');
      const cand = ev?.candidates?.[0];
      const piece = (cand?.content?.parts || [])
        .filter((p) => !p.thought)
        .map((p) => p.text || '')
        .join('');
      if (piece) {
        text += piece;
        if (onText) onText(text);
      }
      if (cand?.finishReason) finishReason = cand.finishReason;
      if (ev?.promptFeedback?.blockReason) blockReason = ev.promptFeedback.blockReason;
    }
  }
  // 마지막 조각 처리
  if (buffer.trim()) {
    const { events } = parseSseEvents(buffer + '\n\n');
    for (const ev of events) {
      const cand = ev?.candidates?.[0];
      const piece = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      if (piece) {
        text += piece;
        if (onText) onText(text);
      }
      if (cand?.finishReason) finishReason = cand.finishReason;
    }
  }

  if (!text) {
    throw new GeminiError(
      `AI가 응답을 만들지 못했습니다${blockReason || finishReason ? ` (${blockReason || finishReason})` : ''}. 자료나 요청을 조금 바꿔 다시 시도해 주세요.`,
      200,
      'empty'
    );
  }
  return { text, finishReason };
}

// 모델 후보를 순서대로 시도하며 스트리밍 생성합니다.
export async function generate({
  apiKey,
  model,
  systemPrompt,
  parts,
  maxOutputTokens = 32768,
  temperature = 0.4,
  onText,
  onModel,
  signal,
}) {
  const candidates = [model, ...MODEL_FALLBACKS.filter((m) => m !== model)];
  let lastError = null;
  for (let idx = 0; idx < candidates.length; idx++) {
    const m = candidates[idx];
    if (onModel) onModel(m);
    // 일시적 과부하(503)는 같은 모델로 한 번 더 시도
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await streamOnce({ apiKey, model: m, systemPrompt, parts, maxOutputTokens, temperature, onText, signal });
        return { ...r, model: m };
      } catch (e) {
        lastError = e;
        if (e.name === 'AbortError') throw e;
        if (e.status === 503 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        break;
      }
    }
    // 모델이 없거나 접근 권한이 없을 때만 다음 후보로 넘어감 (키 오류·한도 초과는 즉시 중단)
    const canFallback =
      lastError && (lastError.status === 404 || (lastError.status === 403 && /model/i.test(lastError.message)));
    if (!canFallback) break;
  }
  throw lastError;
}

export function imagePart(im, label) {
  return [
    ...(label ? [{ text: label }] : []),
    { inlineData: { mimeType: im.mime, data: im.data } },
  ];
}
