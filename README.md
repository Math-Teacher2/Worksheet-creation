# 맞춤형 학습지 자동 생성기 (v4)

내가 평소 쓰던 학습지 양식(PDF/이미지) + 새 교과서 PDF → Gemini가 같은 양식으로 새 학습지를 생성
→ 수식(KaTeX)·그래프가 들어간 학습지 미리보기 → PDF 저장/인쇄.

## 특징
- 각자 자기 Gemini API 키를 화면에 입력해서 사용 (키는 브라우저 → Google로만 전송, 서버 저장 없음)
- 교과서 페이지를 이미지로 읽어 수식·그래프까지 AI가 직접 확인
- 그래프는 AI가 함수식(JSON 명세)만 쓰고, 앱이 정확하게 그림
- 정답지 생성 + AI 정답 재검산, 생성 후 "수정 요청" 가능
- Vercel 무료(Hobby)로 배포 가능. 서버 함수를 쓰지 않아 504 시간 제한이 없음

## 로컬 실행
npm install && npm run dev → http://localhost:3000

## Vercel 배포
1. GitHub에 이 폴더의 내용물을 올리기
2. vercel.com → Add New Project → 저장소 선택 → Deploy (환경변수 필요 없음)

## 구조
- `app/page.js` : 입력 UI, 생성 흐름
- `components/WorksheetView.js` : HTML 학습지 + KaTeX 수식 + 그래프 렌더링
- `lib/gemini.js` : 브라우저에서 Gemini 스트리밍 호출, 모델 자동 대체
- `lib/prompt.js` : AI에게 주는 지시문
- `lib/plot.js` : 함수 그래프 SVG 렌더러
- `lib/pdfClient.js` : PDF → 페이지 이미지 변환
- `lib/sanitize.js` : AI가 만든 HTML 안전 처리
- `lib/sample.js` : 샘플 학습지 (키 없이 미리보기)
- `scripts/copy-worker.mjs` : pdf.js 워커를 public/ 으로 복사 (postinstall)
