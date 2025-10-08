// /zz-predictor.js — 시세 + 업비트식 호가창 (한글)
import { getUpbitPrice, getOrderbook } from "/js/upbit.js";

/* 공통 */
const COINS = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-DOGE"]; // 시세표 코인
function fmtKRW(x, max = 2) {
  return (typeof x === "number" && isFinite(x))
    ? x.toLocaleString("ko-KR", { maximumFractionDigits: max }) + " 원"
    : "불러오기 실패";
}

/* 1) 실시간 시세 박스 (기존 유지) */
async function renderPriceBox() {
  const ts = document.getElementById("zz-upbit-ts");
  const wrap = document.getElementById("zz-upbit-lines");
  if (!wrap) return;
  ts.textContent = "업데이트: " + new Date().toLocaleString("ko-KR", { hour12: false });
  wrap.innerHTML = "";
  for (const mkt of COINS) {
    const px = await getUpbitPrice(mkt);
    const name = mkt.replace("KRW-", "");
    wrap.innerHTML += `
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding:8px 0">
        <span>💎 ${name}</span><b>${fmtKRW(px)}</b>
      </div>`;
  }
}

/* 2) 업비트 호가창 (한글 UI) */
function ensureOrderbookPanel() {
  if (document.getElementById("zz-ob")) return;
  const box = document.createElement("div");
  box.id = "zz-ob";
  box.style.cssText = "max-width:920px;margin:18px auto;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.05);font-family:system-ui,Pretendard,sans-serif";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <b>🧾 업비트 호가창</b>
      <div>
        <label style="font-size:12px;color:#64748b;margin-right:6px">마켓</label>
        <select id="zz-ob-select" style="font-size:14px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px">
          ${COINS.map(c=>`<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <div style="display:flex;justify-content:space-between;color:#ef4444;margin-bottom:6px"><span>매도호가</span><small id="zz-ob-ask-total" style="color:#ef4444"></small></div>
        <div id="zz-ob-asks"></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;color:#3b82f6;margin-bottom:6px"><span>매수호가</span><small id="zz-ob-bid-total" style="color:#3b82f6"></small></div>
        <div id="zz-ob-bids"></div>
      </div>
    </div>
    <div style="margin-top:10px;text-align:right"><small id="zz-ob-ts" style="color:#64748b"></small></div>
  `;
  // 시세 상자 아래에 자동 부착
  const priceBox = document.getElementById("upbit-price-box");
  if (priceBox?.parentNode) priceBox.parentNode.insertBefore(box, priceBox.nextSibling);
  else document.body.appendChild(box);
}

function bar(w, color) {
  return `<span style="display:inline-block;height:16px;width:${Math.min(100,w)}%;background:${color};opacity:.15;border-radius:4px;margin-right:6px;vertical-align:-3px"></span>`;
}
function row(price, size, color, alignRight = false, maxSize = 1) {
  const pct = maxSize ? (size / maxSize) * 100 : 0;
  return `<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #f1f5f9;padding:6px 0;${alignRight?"direction:rtl":""}">
    <span>${bar(pct, color)}<b style="color:${color}">${price.toLocaleString("ko-KR")}</b></span>
    <span style="color:#64748b">${size.toFixed(3)}</span>
  </div>`;
}

async function renderOrderbook() {
  ensureOrderbookPanel();
  const sel = document.getElementById("zz-ob-select");
  const market = sel?.value || "KRW-BTC";
  const data = await getOrderbook(market);
  if (!data) return;

  const asksBox = document.getElementById("zz-ob-asks");
  const bidsBox = document.getElementById("zz-ob-bids");
  const ts = document.getElementById("zz-ob-ts");
  const askT = document.getElementById("zz-ob-ask-total");
  const bidT = document.getElementById("zz-ob-bid-total");

  const units = (data.orderbook_units || []).slice(0, 15); // 15호가
  const maxAsk = Math.max(...units.map(u => u.ask_size), 1);
  const maxBid = Math.max(...units.map(u => u.bid_size), 1);

  // 업비트처럼: 위에 매도호가(높은 가격→낮은 가격), 아래 매수호가(높은 가격→낮은 가격)
  const asks = units.slice().reverse(); // 높은 가격이 위로 오도록
  const bids = units.slice();           // 높은 가격이 위

  asksBox.innerHTML = asks.map(u => row(u.ask_price, u.ask_size, "#ef4444", false, maxAsk)).join("");
  bidsBox.innerHTML = bids.map(u => row(u.bid_price, u.bid_size, "#3b82f6", false, maxBid)).join("");

  askT.textContent = `총 매도량 ${data.total_ask_size.toFixed(3)}`;
  bidT.textContent = `총 매수량 ${data.total_bid_size.toFixed(3)}`;
  ts.textContent = "업데이트: " + new Date(data.timestamp || Date.now()).toLocaleString("ko-KR", { hour12: false });
}

function bindOrderbookEvents() {
  const sel = document.getElementById("zz-ob-select");
  if (sel && !sel.dataset.bound) {
    sel.addEventListener("change", () => renderOrderbook());
    sel.dataset.bound = "1";
  }
}

/* 초기화 + 주기적 갱신 */
function init() {
  renderPriceBox();
  setInterval(renderPriceBox, 3000);

  ensureOrderbookPanel();
  bindOrderbookEvents();
  renderOrderbook();
  setInterval(renderOrderbook, 2000);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
