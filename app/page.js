'use client';

import { useEffect, useRef, useState } from 'react';
import WorksheetView from '../components/WorksheetView';
import { generate, imagePart } from '../lib/gemini';
import { SYSTEM_PROMPT, buildReviewPrompt, buildRevisePrompt } from '../lib/prompt';
import { SAMPLE_HTML } from '../lib/sample';
import { stripFences } from '../lib/sanitize';

const REVIEW_SYSTEM = '너는 꼼꼼한 수학 검산 전문가이자 학습지 편집자다. 지시받은 출력 형식(HTML 조각만)을 정확히 지킨다.';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [rememberKey, setRememberKey] = useState(true);

  const [templateFile, setTemplateFile] = useState(null);
  const [templatePages, setTemplatePages] = useState('');
  const [sourceFile, setSourceFile] = useState(null);
  const [sourcePages, setSourcePages] = useState('');
  const [scope, setScope] = useState('');
  const [grade, setGrade] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [reviewAnswers, setReviewAnswers] = useState(true);

  const [html, setHtml] = useState('');
  const [showAnswers, setShowAnswers] = useState(true);
  const [reviseText, setReviseText] = useState('');
  const [status, setStatus] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeModel, setActiveModel] = useState('');
  const abortRef = useRef(null);

  // 이 브라우저에 저장해 둔 키/모델 불러오기
  useEffect(() => {
    try {
      const k = localStorage.getItem('gemini_api_key');
      const m = localStorage.getItem('gemini_model');
      if (k) setApiKey(k);
      if (m) setModel(m);
    } catch {}
  }, []);

  // 경과 시간 표시
  useEffect(() => {
    if (!loading) return;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [loading]);

  function saveKey() {
    try {
      if (rememberKey) {
        localStorage.setItem('gemini_api_key', apiKey.trim());
        localStorage.setItem('gemini_model', model.trim());
      } else {
        localStorage.removeItem('gemini_api_key');
        localStorage.removeItem('gemini_model');
      }
    } catch {}
  }

  async function run(job) {
    setError('');
    setWarning('');
    if (!apiKey.trim()) {
      setError('Gemini API 키를 입력해 주세요.');
      return;
    }
    saveKey();
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await job(ctrl.signal);
      setStatus('');
    } catch (e) {
      if (e.name === 'AbortError') setError('중단했습니다.');
      else setError(e.message || String(e));
      setStatus('');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  const callModel = (args) =>
    generate({
      apiKey: apiKey.trim(),
      model: model.trim(),
      onModel: (m) => setActiveModel(m),
      ...args,
    });

  function handleGenerate() {
    if (!sourceFile) {
      setError('교과서/자료 PDF를 업로드해 주세요.');
      return;
    }
    run(async (signal) => {
      const { prepareTemplate, prepareSource } = await import('../lib/pdfClient');

      let tpl = { images: [] };
      if (templateFile) {
        setStatus('양식 파일을 읽는 중...');
        tpl = await prepareTemplate(templateFile, templatePages, (i, n) => setStatus(`양식 파일을 읽는 중... (${i}/${n})`));
      }
      setStatus('교과서 페이지를 읽는 중...');
      const src = await prepareSource(sourceFile, sourcePages, (i, n) => setStatus(`교과서 페이지를 읽는 중... (${i}/${n})`));

      const parts = [{ text: '[A] 교사가 평소 쓰는 학습지 양식입니다. 아래 이미지의 구성·서식·문체를 분석하세요.' }];
      if (tpl.images.length) {
        tpl.images.forEach((im, i) => parts.push(...imagePart(im, `[A 양식 ${i + 1}번째 이미지]`)));
      } else {
        parts.push({ text: '(양식 파일 없음: 일반적인 고등학교 수학 학습지 형식으로 만든다)' });
      }
      parts.push({ text: '[B] 새로 가르칠 교과서입니다. 아래 이미지가 주 자료이고, 함께 주는 텍스트는 수식이 빠져 있을 수 있습니다.' });
      src.images.forEach((im) => {
        const txt = im.text ? ` 추출 텍스트(참고용): ${im.text.slice(0, 1200)}` : '';
        parts.push(...imagePart(im, `[B 교과서 PDF ${im.page}번째 쪽]${txt}`));
      });

      const wants = [
        `위 [A]의 양식을 그대로 활용해서 [B]의 내용으로 새 학습지를 만들어 주세요.`,
        `- 대상: ${grade.trim() || '고등학교 학생'}`,
        `- 난이도: ${difficulty || '[A]와 비슷하게'}`,
        `- 만들 범위/차시 지시: ${scope.trim() || '지정 없음 (교과서 내용을 소단원·개념 단위의 차시로 나누어 모두 만든다)'}`,
        `- 정답 및 해설 페이지: ${includeAnswers ? '포함' : '넣지 않음'}`,
        'HTML 조각만 출력하세요.',
      ];
      parts.push({ text: wants.join('\n') });

      setStatus('AI가 작성하는 중...');
      const r = await callModel({
        systemPrompt: SYSTEM_PROMPT,
        parts,
        signal,
        onText: (t) => setStatus(`AI가 작성하는 중... (${t.length.toLocaleString()}자 작성됨)`),
      });
      let out = stripFences(r.text);
      if (r.finishReason === 'MAX_TOKENS') {
        setWarning('분량이 길어 끝부분이 잘렸을 수 있습니다. 교과서 쪽 범위를 줄이거나 "만들 범위"를 나눠서 다시 만들어 보세요.');
      }
      setHtml(out);

      if (reviewAnswers && includeAnswers && r.finishReason !== 'MAX_TOKENS') {
        setStatus('정답을 한 번 더 검산하는 중...');
        try {
          const rv = await callModel({
            systemPrompt: REVIEW_SYSTEM,
            parts: [{ text: buildReviewPrompt(out) }],
            temperature: 0.1,
            signal,
            onText: (t) => setStatus(`정답을 한 번 더 검산하는 중... (${t.length.toLocaleString()}자)`),
          });
          const fixed = stripFences(rv.text);
          if (rv.finishReason !== 'MAX_TOKENS' && fixed.includes('<section') && fixed.length > out.length * 0.7) {
            setHtml(fixed);
          }
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          setWarning((w) => `${w} 정답 재검산 단계는 실패해서 1차 결과를 그대로 보여드립니다. (${e.message})`.trim());
        }
      }
    });
  }

  function handleRevise() {
    if (!html || !reviseText.trim()) return;
    run(async (signal) => {
      setStatus('수정 요청을 반영하는 중...');
      const r = await callModel({
        systemPrompt: REVIEW_SYSTEM,
        parts: [{ text: buildRevisePrompt(html, reviseText.trim()) }],
        temperature: 0.3,
        signal,
        onText: (t) => setStatus(`수정 요청을 반영하는 중... (${t.length.toLocaleString()}자)`),
      });
      const out = stripFences(r.text);
      if (r.finishReason === 'MAX_TOKENS' || !out.includes('<section')) {
        throw new Error('수정 결과가 너무 길거나 형식이 깨져서 반영하지 않았습니다. 요청을 더 작게 나눠 주세요.');
      }
      setHtml(out);
      setReviseText('');
    });
  }

  return (
    <main>
      <aside className="panel no-print">
        <h1>📝 맞춤형 학습지 생성기</h1>

        <div className="keybox">
          <label>
            내 Gemini API 키
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              autoComplete="off"
            />
          </label>
          <label>
            모델 이름
            <input list="model-list" value={model} onChange={(e) => setModel(e.target.value)} />
            <datalist id="model-list">
              <option value="gemini-3.8-flash" />
              <option value="gemini-3.6-flash" />
              <option value="gemini-3.5-flash-lite" />
            </datalist>
          </label>
          <label className="check">
            <input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} />
            이 브라우저에 키 기억하기
          </label>
          <p className="hint">
            키는 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>에서 무료로
            발급받을 수 있습니다. 키는 내 브라우저에서 Google로만 전송되며, 이 사이트 서버로는 전송되지 않습니다.
          </p>
        </div>

        <label>
          1. 내가 쓰던 학습지 양식 (PDF/이미지)
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} />
        </label>
        <label>
          양식으로 참고할 쪽 (예: 1-4) — 비우면 앞 4쪽
          <input value={templatePages} onChange={(e) => setTemplatePages(e.target.value)} placeholder="1-4" />
        </label>

        <label>
          2. 새로 가르칠 교과서 (PDF, 필수)
          <input type="file" accept="application/pdf" onChange={(e) => setSourceFile(e.target.files?.[0] || null)} />
        </label>
        <label>
          사용할 쪽 (PDF 파일의 쪽 번호 기준, 예: 3-8)
          <input value={sourcePages} onChange={(e) => setSourcePages(e.target.value)} placeholder="비우면 전체 (최대 30쪽)" />
        </label>
        <p className="hint">한 번에 교과서 4~8쪽(1~2차시)씩 만들 때 품질이 가장 좋고 빠릅니다.</p>

        <label>
          만들 범위·차시 (선택)
          <textarea
            rows={3}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="예: 1차시 함수의 수렴과 발산(교과서 10~13쪽), 2차시 우극한과 좌극한(15쪽)"
          />
        </label>

        <div className="row">
          <label>
            학년/대상
            <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="예: 고2" />
          </label>
          <label>
            난이도
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">양식과 비슷하게</option>
              <option value="쉬움">쉬움</option>
              <option value="보통">보통</option>
              <option value="어려움">어려움</option>
            </select>
          </label>
        </div>

        <label className="check">
          <input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} />
          정답 및 해설 페이지 만들기
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={reviewAnswers}
            disabled={!includeAnswers}
            onChange={(e) => setReviewAnswers(e.target.checked)}
          />
          정답을 AI가 한 번 더 검산 (시간 2배, 권장)
        </label>

        <button onClick={handleGenerate} disabled={loading}>
          {loading ? '작업 중...' : '학습지 생성'}
        </button>
        {loading ? (
          <button className="secondary" onClick={() => abortRef.current?.abort()}>
            중단
          </button>
        ) : null}
        {status ? (
          <p className="status">
            {status} <span className="muted">({elapsed}초)</span>
          </p>
        ) : null}
        {loading && activeModel ? <p className="hint">사용 중인 모델: {activeModel}</p> : null}
        {warning ? <p className="warn">{warning}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {html ? (
          <>
            <button className="secondary" onClick={() => window.print()}>
              🖨️ PDF 저장 / 인쇄
            </button>
            <p className="hint">인쇄 창에서 대상을 “PDF로 저장”으로 고르고, 설정에서 “배경 그래픽”을 켜면 가장 예쁘게 저장됩니다.</p>
            <label className="check">
              <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
              정답지 표시/인쇄
            </label>
            <label>
              수정 요청
              <textarea
                rows={3}
                value={reviseText}
                onChange={(e) => setReviseText(e.target.value)}
                placeholder="예: 3번 문제를 더 쉽게, [생각해보기]를 하나 더 추가"
              />
            </label>
            <button className="secondary" onClick={handleRevise} disabled={loading || !reviseText.trim()}>
              수정 반영
            </button>
          </>
        ) : (
          <button
            className="ghost"
            onClick={() => {
              setHtml(SAMPLE_HTML);
              setError('');
              setWarning('');
            }}
          >
            샘플 학습지 미리보기 (키 없이)
          </button>
        )}
      </aside>

      <section className="preview">
        {html ? (
          <WorksheetView html={html} showAnswers={showAnswers} />
        ) : (
          <div className="empty no-print">
            왼쪽에서 양식과 교과서를 올리고 <b>학습지 생성</b>을 누르면 여기에 결과가 표시됩니다.
          </div>
        )}
      </section>
    </main>
  );
}
