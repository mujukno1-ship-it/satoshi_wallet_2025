// ⚡ 사토시의지갑 — 급등/예열 자동탐지 및 매수·매도 타점 계산
import { getUpbitTicker } from "../api/upbit.js";

const resultBox = document.getElementById("zz-upbit-ts");
const tableBody = document.getElementById("coin-table-body");
const scanBtn = document.getElementById("scan-btn");

function fmtKRW(x) {
  return Number(x).toLocaleString("ko-KR") + "원";
}

// ---------------- 매수·매도 타점 계산 ----------------
function analyze(price, changeRate) {
  let buy = "-", sell = "-", risk = 3, msg = "";

  if (changeRate > 0.15) {
    msg = "🔥 단기 급등 — 분할 익절 구간";
    risk = 4;
    sell = fmtKRW(price * 1.02);
  } else if (changeRate < -0.05) {
    msg = "🩵 저점 진입 후보 — 기술적 반등 가능성";
    risk = 2;
    buy = fmtKRW(price * 0.98);
  } else {
    msg = "📊 관망 — 변동성 약함";
    risk = 3;
  }

  return { buy, sell, risk, msg };
}

// ---------------- 예열코인 자동탐지 ----------------
async function onScanPreheat() {
  tableBody.innerHTML = `<tr><td colspan="10">⏳ 예열 스캔 중... (잠시만 기다려주세요)</td></tr>`;

  try {
    const marketRes = await fetch("/api/markets");
    const markets = await marketRes.json();
    const krwMarkets = markets.filter(m => m.market.startsWith("KRW-"));
    const marketList = krwMarkets.map(m => m.market);

    const tickerRes = await fetch(`/api/tickers?markets=${encodeURIComponent(marketList.join(","))}`);
    const tickers = await tickerRes.json();

    const hot = tickers
      .filter(t => t.signed_change_rate >= 0.08)
      .sort((a, b) => b.signed_change_rate - a.signed_change_rate)
      .slice(0, 10);

    if (hot.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10">🚫 현재 조건에 맞는 급등 코인이 없습니다.</td></tr>`;
      return;
    }

    tableBody.innerHTML = "";
    for (const t of hot) {
      const name = t.market.replace("KRW-", "");
      const changeRate = t.signed_change_rate;
      const price = t.trade_price;
      const { buy, sell, risk, msg } = analyze(price, changeRate);

      const row = `
        <tr>
          <td>${name}</td>
          <td>${fmtKRW(price)}</td>
          <td>${buy}</td>
          <td>${sell}</td>
          <td>${risk}</td>
          <td>${(changeRate * 100).toFixed(2)}%</td>
          <td>${msg}</td>
        </tr>`;
      tableBody.insertAdjacentHTML("beforeend", row);
    }
  } catch (e) {
    console.error("예열탐지 오류:", e);
    tableBody.innerHTML = `<tr><td colspan="10">⚠️ 오류 발생: ${e.message}</td></tr>`;
  }
}

// ---------------- 초기 실행 ----------------
window.addEventListener("load", onScanPreheat);
scanBtn.addEventListener("click", onScanPreheat);
