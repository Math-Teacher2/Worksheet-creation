// 샘플 학습지 (API 키 없이 화면/인쇄 모양을 확인하는 용도이자,
// AI에게 "이런 HTML 규칙으로 작성하라"고 보여주는 예시입니다.)

export const SAMPLE_HTML = String.raw`
<section class="ws-page">
<table class="ws-head">
<tr><td class="c">미적분 Ⅰ</td><td class="c">대단원</td><td>Ⅰ. 함수의 극한과 연속</td><td class="c">소단원</td><td>1. 함수의 극한</td><td class="c">차시</td><td class="c">1</td></tr>
<tr><td>학번(&emsp;&emsp;&emsp;) 이름(&emsp;&emsp;&emsp;&emsp;)</td><td class="c">학습목표</td><td colspan="3">함수의 극한의 뜻을 알고, 함수의 수렴과 발산을 판별할 수 있다.</td><td class="c">날짜</td><td></td></tr>
</table>

<div class="ws-box ws-title">함수의 수렴</div>
<div class="ws-box">
  <div class="cols2 center">
    <div class="plot" data-spec='{"w":250,"h":190,"xmin":-2,"xmax":3.5,"ymin":-1.5,"ymax":3.5,"curves":[{"expr":"x+1","from":-1.8,"to":3}],"points":[{"x":1,"y":2}],"guides":[{"x":1,"y":2}],"ticks":{"x":[1],"y":[1,2]},"labels":[{"x":2.1,"y":2.9,"text":"y=f(x)"}]}'></div>
    <div class="plot" data-spec='{"w":250,"h":190,"xmin":-2,"xmax":3.5,"ymin":-1.5,"ymax":3.5,"curves":[{"expr":"(x^2-1)/(x-1)","from":-1.8,"to":3}],"points":[{"x":1,"y":2,"open":true}],"guides":[{"x":1,"y":2}],"ticks":{"x":[1],"y":[1,2]},"labels":[{"x":2.1,"y":2.9,"text":"y=g(x)"}]}'></div>
  </div>
  <p>함수 \(f(x)=x+1\)에서 \(x\)의 값이 1이 아니면서 1에 한없이 가까워질 때, \(f(x)\)의 값은 <span class="blank s"></span>에 한없이 가까워진다.</p>
  <p>함수 \(g(x)=\dfrac{x^2-1}{x-1}\)은 \(x\neq 1\)인 모든 실수 \(x\)에서 \(g(x)=\) <span class="blank"></span> 이므로, \(x\)의 값이 1이 아니면서 1에 한없이 가까워질 때 \(g(x)\)의 값은 <span class="blank s"></span>에 한없이 가까워진다.</p>
</div>
<div class="ws-box">
  <p>함수 \(f(x)\)에서 \(x\)의 값이 \(a\)가 아니면서 \(a\)에 한없이 가까워질 때, \(f(x)\)의 값이 일정한 값 \(L\)에 한없이 가까워지면 함수 \(f(x)\)는 \(L\)에 <span class="blank m"></span>한다고 한다.</p>
  <p>이것을 기호로 <span class="blank l"></span> 또는 <span class="blank l"></span> (\(x\to a\)일 때) 와 같이 나타내고, \(L\)을 함수 \(f(x)\)의 \(x=a\)에서의 <span class="blank m"></span> 또는 <span class="blank m"></span>이라고 한다.</p>
  <p class="note">※ \(x\to a\)는 \(x\)의 값이 \(a\)가 아니면서 \(a\)에 한없이 가까워짐을 뜻한다.</p>
  <p>[예시]</p>
  <div class="cols3">
    <div>① \(\displaystyle\lim_{x\to 1}(x+1)=\) <span class="blank s"></span></div>
    <div>② \(\displaystyle\lim_{x\to 1}\dfrac{x^2-1}{x-1}=\) <span class="blank s"></span></div>
    <div>③ \(\displaystyle\lim_{x\to a}c=\) <span class="blank s"></span></div>
  </div>
</div>
<div class="ws-box">
  <p>함수의 그래프를 이용하여 다음 극한값을 구하시오. <span class="pg">[교과서 11~12쪽]</span></p>
  <div class="cols2">
    <div>(1) \(\displaystyle\lim_{x\to 1}(x^2+2x)\)</div>
    <div>(2) \(\displaystyle\lim_{x\to 2}\dfrac{2x^2-3x-2}{x-2}\)</div>
    <div>(3) \(\displaystyle\lim_{x\to -1}(x-1)^2\)</div>
    <div>(4) \(\displaystyle\lim_{x\to 3}\dfrac{x^2+2x-15}{x-3}\)</div>
  </div>
  <div class="space s"></div>
</div>
<div class="ws-box">
  <p>[생각해보기] 함수 \(f(x)\)가 \(x=a\)에서 정의되지 않으면 \(\displaystyle\lim_{x\to a}f(x)\)는 존재하지 않는다. 참인지 거짓인지 판단하고, 이유를 설명해 보시오.</p>
  <div class="space m"></div>
</div>
</section>

<section class="ws-page answer-key">
<h2>정답 및 해설</h2>
<ol class="ans-list">
<li><b>함수의 수렴</b> 빈칸 순서대로: <span class="ans">2</span>, <span class="ans">\(x+1\)</span>, <span class="ans">2</span>, <span class="ans">수렴</span>, <span class="ans">\(\lim_{x\to a}f(x)=L\)</span>, <span class="ans">\(f(x)\to L\)</span>, <span class="ans">극한</span>, <span class="ans">극한값</span></li>
<li>[예시] ① <span class="ans">2</span> ② <span class="ans">2</span> ③ <span class="ans">\(c\)</span></li>
<li>(1) <span class="ans">3</span> (2) <span class="ans">5</span> (3) <span class="ans">4</span> (4) <span class="ans">8</span> — (2)는 \(\dfrac{(2x+1)(x-2)}{x-2}=2x+1\), (4)는 \(\dfrac{(x+5)(x-3)}{x-3}=x+5\)로 약분하여 구한다.</li>
<li>[생각해보기] <span class="ans">거짓</span> — 극한은 \(x=a\)에서의 함숫값과 무관하다. (예: \(g(x)=\dfrac{x^2-1}{x-1}\)은 \(x=1\)에서 정의되지 않지만 극한값은 2이다.)</li>
</ol>
</section>
`;
