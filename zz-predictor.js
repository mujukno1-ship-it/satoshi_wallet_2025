// /zz-predictor.js — 업비트 실시간 시세 박스 완성
import { getUpbitPrice } from "/js/upbit.js";

const COINS = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-DOGE"]; // 원하는 코인 추가 가능

function fmtKRW(x, max = 2) {
  return (typeof x === "number" && isFinite(x))
    ? x.toLocaleString("ko-KR", { maximumFractionDigits: max }) + " 원"
    : "불러오기 실패";
}

async function renderUpbitBox() {
  const ts = document.getElementById("zz-upbit-ts");
  const wrap = document.getElementById("zz-upbit-lines");
  if (!wrap) return;

  ts.textContent = "업데이트: " + new Date().toLocaleString("ko-KR", { hour12: false });
  wrap.innerHTML = "";

  for (const market of COINS) {
    const price = await getUpbitPrice(market);
    const name = market.replace("KRW-", "");
    wrap.innerHTML += `
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:6px 0">
        <span>💎 ${name}</span>
        <b>${fmtKRW(price)}</b>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderUpbitBox();
  setInterval(renderUpbitBox, 3000); // 3초마다 새로고침
});
