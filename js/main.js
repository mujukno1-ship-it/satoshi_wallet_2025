// 💎 사토시의지갑 — 풀세트∞ 자동분석 + 예열 시작/종료 시간 표시 (쩔다 전용)

const COINS = [
  { name: "비트코인", symbol: "BTC", price: 177936000, rsi: 32.5, volume: 1.4, trend: 1 },
  { name: "이더리움", symbol: "ETH", price: 6504000,  rsi: 48.2, volume: 1.1, trend: 0 },
  { name: "시바이누", symbol: "SHIB", price: 0.0176,  rsi: 61.8, volume: 1.8, trend: 2 },
  { name: "솔라나",  symbol: "SOL", price: 233000,    rsi: 42.3, volume: 0.9, trend: -1 },
];

const tableBody = document.getElementById("coin-data");
const searchBox  = document.getElementById("search");
const searchBtn  = document.getElementById("search-btn");

// 숫자/시간 포맷
const fmt = (x) => (typeof x === "number" ? x.toLocaleString("ko-KR") : x);
const fmtTime = (d) => d ? d.toLocaleTimeString("ko-KR", { hour12:false }) : "-";

// 예열 시간 추정 도우미
function estimatePreheatWindow({ rsi, volume, trend }) {
  const now = new Date();

  // 기본: 예열 지속 15~45분 (거래량/추세/RSI로 가중)
  let minutes = 25;

  // 거래량이 많으면 예열이 더 짧고 강하게 끝나는 경향
  if (volume >= 1.6) minutes -= 7;
  else if (volume >= 1.3) minutes -= 4;
  else if (volume <= 0.9) minutes += 6;

  // RSI 과열/과매도 보정
  if (rsi >= 65) minutes -= 5;      // 과열: 빨리 끝남
  if (rsi <= 35) minutes += 5;      // 과매도 반등: 길어질 수 있음

  // 추세(세력) 보정: 2=강상승, 1=상승, 0=중립, -1=약세
  if (trend >= 2) minutes -= 6;
  else if (trend === 1) minutes -= 2;
  else if (trend <= -1) minutes += 4;

  // 최소/최대 클램프
  minutes = Math.max(10, Math.min(minutes, 50));

  // 예열 상태 분류 & 시작/종료 시각 생성
  // trend>0 또는 (rsi 40~60 & volume>1.2)이면 "예열중"으로 판단
  const preheating =
    trend > 0 || (rsi >= 40 && rsi <= 60 && volume > 1.2);

  if (preheating) {
    // 예열 시작: 지금 기준 3~10분 전
    const startOffset = Math.floor(3 + (rsi % 8)); // 간단한 의사 난수
    const start = new Date(now.getTime() - startOffset * 60 * 1000);
    const end   = new Date(start.getTime() + minutes * 60 * 1000);
    return { status: "예열중🔥", start, end };
  }

  // 과열/급등 중: 시작은 조금 더 이전, 종료는 더 빠르게
  if (rsi > 65 && volume > 1.4) {
    const start = new Date(now.getTime() - 15 * 60 * 1000);
    const end   = new Date(now.getTime() + 8 * 60 * 1000);
    return { status: "급등중⚡", start, end };
  }

  // 그 외 안정/중립
  return { status: "안정🧊", start: null, end: null };
}

// 분석 기반 타점/위험도/한마디
function analyzeCoin(coin) {
  const { rsi, volume, trend } = coin;
  let signal, risk, comment;

  if (rsi < 30 && volume > 1.2) {
    signal = "매수"; risk = 2; comment = "세력 매집 포착 — 기술적 반등 임박";
  } else if (rsi > 70 && volume > 1.5) {
    signal = "매도"; risk = 4; comment = "급등 후 조정 가능성 — 분할 익절 권장";
  } else if (trend > 1) {
    signal = "매수"; risk = 3; comment = "세력 돌파 신호 — 단기 상승세 지속";
  } else if (trend < 0) {
    signal = "관망"; risk = 1; comment = "에너지 축적 구간 — 대기 권장";
  } else {
    signal = "관망"; risk = 2; comment = "방향성 탐색 중...";
  }

  // 가격 기반 타점
  const buy  = coin.price * 0.995;
  const sell = coin.price * 1.015;
  const stop = coin.price * 0.985;
  const take = coin.price * 1.03;

  // 예열 윈도우 추정
  const { status, start, end } = estimatePreheatWindow(coin);

  return { ...coin, signal, risk, comment, buy, sell, stop, take, heat: status, start, end };
}

// 렌더링
function render(coins) {
  tableBody.innerHTML = "";
  coins.forEach((c) => {
    const a = analyzeCoin(c);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${a.name}</td>
      <td>${fmt(a.price)} 원</td>
      <td>${fmt(a.buy)}</td>
      <td>${fmt(a.sell)}</td>
      <td>${fmt(a.stop)}</td>
      <td>${fmt(a.take)}</td>
      <td>${a.risk}</td>
      <td>${a.heat}</td>
      <td>${fmtTime(a.start)}</td>
      <td>${fmtTime(a.end)}</td>
      <td>${a.comment}</td>
    `;
    tableBody.appendChild(row);
  });
}

// 검색
searchBtn.addEventListener("click", () => {
  const keyword = searchBox.value.trim();
  const result = COINS.filter((c) => c.name.includes(keyword));
  render(result.length ? result : COINS);
});
searchBox.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

// 초기 표시
render(COINS);
