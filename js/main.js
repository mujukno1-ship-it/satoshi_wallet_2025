/* ======================================================
 🪙 사토시의지갑 — 풀세트 실전버전 (쩔다 전용)
 기존기능 유지 + 매수매도타점 + 예열탐지 + 쩔어의한마디
====================================================== */

import { getUpbitTicker } from "../api/upbit.js";

const coins = ["BTC", "ETH", "XRP", "DOGE", "SHIB"];
const resultBox = document.getElementById("zz-upbit-ts");

function fmtKRW(x) {
  return x.toLocaleString("ko-KR") + " 원";
}

/* ------------------ 1️⃣ 매수·매도 타점 계산 ------------------ */
function calcSignal(price, changeRate) {
  let signal, risk, comment;

  if (changeRate > 0.05) {
    signal = "매도";
    risk = 4;
    comment = "급등 이후 과열 구간 — 분할 익절 권장🔥";
  } else if (changeRate < -0.05) {
    signal = "매수";
    risk = 2;
    comment = "급락 구간 — 기술적 반등 가능성⚡";
  } else {
    signal = "관망";
    risk = 1;
    comment = "횡보중 — 세력 대기 중...";
  }

  return { signal, risk, comment };
}

/* ------------------ 2️⃣ 예열탐지 코인 ------------------ */
async function findHotCoins() {
  const hotList = [];
  for (const c of coins) {
    const data = await getUpbitTicker("KRW-" + c);
    const rate = data.signed_change_rate;
    if (Math.abs(rate) >= 0.08) {
      hotList.push({
        name: c,
        rate: (rate * 100).toFixed(2) + "%",
        signal: rate > 0 ? "상승 예열🔥" : "하락 예열⚠️",
      });
    }
  }
  return hotList;
}

/* ------------------ 3️⃣ 실시간 표시 ------------------ */
async function render() {
  const now = new Date();
  const box = document.getElementById("zz-upbit-box");
  const hotCoins = await findHotCoins();

  box.innerHTML = `
    <h3>업비트 실시간 시세</h3>
    <p>업데이트: ${now.toLocaleTimeString("ko-KR")}</p>
    <ul>
      ${coins.map(c => `<li>💎 ${c}</li>`).join("")}
    </ul>

    <h4>🔥 예열탐지코인</h4>
    ${
      hotCoins.length
        ? hotCoins.map(h => `<p>${h.name} — ${h.signal} (${h.rate})</p>`).join("")
        : "현재 조건에 맞는 급등 코인이 없습니다."
    }
  `;

  // 매수·매도 신호 출력
  const btc = await getUpbitTicker("KRW-BTC");
  const sig = calcSignal(btc.trade_price, btc.signed_change_rate);
  document.getElementById("result").innerHTML = `
    <h4>💰 BTC 매매 신호</h4>
    <p>현재가: ${fmtKRW(btc.trade_price)} (${(btc.signed_change_rate*100).toFixed(2)}%)</p>
    <p>신호: ${sig.signal} | 위험도: ${sig.risk} | ${sig.comment}</p>
  `;
}

/* ------------------ 4️⃣ 자동 갱신 ------------------ */
setInterval(render, 5000);
render();
