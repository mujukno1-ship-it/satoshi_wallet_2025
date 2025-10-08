// /zz-predictor.js — 기존 화면 유지 + 실시간 시세 갱신
import { getUpbitPrice } from "/js/upbit.js";

const COINS = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-DOGE"]; // 여기서 추가/삭제

function fmtKRW(x, max = 4) {
  return (typeof x === "number" && isFinite(x))
    ? x.toLocaleString("ko-KR", { maximumFractionDigits: max }) + " 원"
    : "불러오기 실패";
}

async function renderUpbitBox() {
  const ts = document.getElementById("zz-upbit-ts");
  const wrap = document.getElementById("zz-upbit-lines");
  if (!wrap) return;

  ts.textContent = "KST " + new Date().toLocaleString("ko-KR", { hour12: false });
  wrap.innerHTML = "";

  for (const m of COINS) {
    const px = await getUpbitPrice(m);
    const name = m.replace("KRW-", "");
    wrap.innerHTML += `
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding:8px 0">
        <span>💎 ${name}</span><b>${fmtKRW(px)}</b>
      </div>`;
  }
}

// 최초 실행 + 3초마다 갱신
document.addEventListener("DOMContentLoaded", () => {
  renderUpbitBox();
  setInterval(renderUpbitBox, 3000);
});
