import './globals.css';

export const metadata = {
  title: '맞춤형 학습지 생성기',
  description: '기존 학습지 양식 + 교과서 내용으로 새 학습지를 자동 생성합니다.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
