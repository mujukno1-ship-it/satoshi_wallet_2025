// 💎 사토시의지갑 — 풀세트∞ 자동분석 실전판 (쩔다 전용)
// 기존 기능 유지 + 업비트 UI + AI 기반 자동 타점 + 예열탐지 강화

const COINS = [
  { name: "비트코인", symbol: "BTC", price: 177936000, rsi: 32.5, volume: 1.4, trend: 1 },
  { name: "이더리움", symbol: "ETH", price: 6504000, rsi: 48.2, volume: 1.1, trend: 0 },
  { name: "시바이누", symbol: "SHIB", price: 0.0176, rsi: 61.8, volume: 1.8, trend: 2 },
  { name: "솔라나", symbol: "SOL", price: 233000, rsi: 42.3, volume: 0.9, trend: -1 },
];

// HTML 연결
const tableBody = document.getElementById("coin-data");
const searchBox = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");

// 숫자 포맷
const fmt = (x) => (typeof x === "number" ? x.toLocaleString("ko-KR") : x);

// 분석 기반 타점 계산
function analyzeCoin(coin) {
  let signal, risk, heat, comment;
  const { rsi, volume, trend } = coin;

  // RSI + 거래량 + 추세 기반 AI 판단
  if (rsi < 30 && volume > 1.2) {
    signal = "매수";
    heat = "예열중🔥";
    risk = 2;
    comment = "세력 매집 포착 — 기술적 반등 임박";
  } else if (rsi > 70 && volume > 1.5) {
    signal = "매도";
    heat = "과열⚠️";
    risk = 4;
    comment = "급등 후 조정 가능성 — 분할 익절 권장";
  } else if (trend > 1) {
    signal = "매수";
    heat = "급등중⚡";
    risk = 3;
    comment = "세력 돌파 신호 — 단기 상승세 지속";
  } else if (trend < 0) {
    signal = "관망";
    heat = "안정🧊";
    risk = 1;
    comment = "에너지 축적 구간 — 대기 권장";
  } else {
    signal = "관망";
    heat = "중립";
    risk = 2;
    comment = "방향성 탐색 중...";
  }

  // 가격 기반 매수·매도·손절·익절 계산
  const buy = coin.price * 0.995;
  const sell = coin.price * 1.015;
  const stop = coin.price * 0.985;
  const take = coin.price * 1.03;

  return { ...coin, signal, heat, risk, comment, buy, sell, stop, take };
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
      <td>${a.comment}</td>
    `;
    tableBody.appendChild(row);
  });
}

// 검색 기능
searchBtn.addEventListener("click", () => {
  const keyword = searchBox.value.trim();
  const result = COINS.filter((c) => c.name.includes(keyword));
  render(result.length ? result : COINS);
});

// 엔터키로 검색
searchBox.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

// 초기 표시
render(COINS);
