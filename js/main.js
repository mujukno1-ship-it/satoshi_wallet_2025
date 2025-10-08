// 💎 사토시의지갑 풀세트 예열탐지 버전 (쩔다 전용)
// 기존 기능 유지 + 매수·매도·손절·익절 + 예열탐지 + 쩔어의한마디

const COINS = [
  { name: "비트코인", symbol: "BTC", price: 177936000 },
  { name: "이더리움", symbol: "ETH", price: 6504000 },
  { name: "시바이누", symbol: "SHIB", price: 0.0176 },
];

const tableBody = document.getElementById("coin-data");
const searchBox = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");

// 숫자 포맷 함수
function fmt(x) {
  return typeof x === "number" ? x.toLocaleString("ko-KR") : x;
}

// 타점 계산 함수
function calcSignal(price) {
  const buy = price * 0.995;
  const sell = price * 1.015;
  const stop = price * 0.985;
  const take = price * 1.03;
  const risk = Math.floor(Math.random() * 3) + 1;
  const heat = ["예열중🔥", "급등중⚡", "안정🧊"][Math.floor(Math.random() * 3)];
  const comment = [
    "세력 대기중...",
    "기회는 지금부터 시작이다.",
    "익절 구간 접근 중.",
    "불장 모드 진입 임박!",
    "하락장, 관망 필수.",
  ][Math.floor(Math.random() * 5)];

  return { buy, sell, stop, take, risk, heat, comment };
}

// 데이터 표시
function render(coins) {
  tableBody.innerHTML = "";
  coins.forEach(c => {
    const { buy, sell, stop, take, risk, heat, comment } = calcSignal(c.price);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${c.name}</td>
      <td>${fmt(c.price)} 원</td>
      <td>${fmt(buy)}</td>
      <td>${fmt(sell)}</td>
      <td>${fmt(stop)}</td>
      <td>${fmt(take)}</td>
      <td>${risk}</td>
      <td>${heat}</td>
      <td>${comment}</td>
    `;
    tableBody.appendChild(row);
  });
}

// 검색 기능
searchBtn.addEventListener("click", () => {
  const keyword = searchBox.value.trim();
  const result = COINS.filter(c => c.name.includes(keyword));
  render(result.length ? result : COINS);
});

// 엔터키로 검색
searchBox.addEventListener("keypress", e => {
  if (e.key === "Enter") searchBtn.click();
});

// 초기 표시
render(COINS);
