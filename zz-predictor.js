// /zz-predictor.js — 실시간 시세 + 급등 코인(8~50%) 패널
import { getUpbitPrice, getTickers, getOrderbook } from "/js/upbit.js";

/* ===== 설정 ===== */
const PRICE_COINS = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-DOGE"]; // 상단 시세표
const MOVERS = [
  "KRW-BTC","KRW-ETH","KRW-XRP","KRW-DOGE","KRW-SOL","KRW-AVAX","KRW-SHIB",
  "KRW-ADA","KRW-LINK","KRW-NEAR","KRW-ATOM","KRW-AERGO","KRW-ARB","KRW-SUI"
]; // 급등 감시 대상
const SHOW_ORDERBOOK = false; // true 로 바꾸면 호가창 표시

/* ===== 공통 포맷 ===== */
function krw(x, max = 2) {
  return (typeof x === "number" && isFinite(x))
    ? x.toLocaleString("ko-KR", { maximumFractionDigits: max }) + " 원"
    : "불러오기 실패";
}
function pct(x) {
  if (typeof x !== "number" || !isFinite(x)) return "0.0%";
  const s = x * 100;
  return `${s >= 0 ? "+" : ""}${s.toFixed(1)}%`;
}
function changeEmoji(rate) {
  if (rate >= 0.40) return "⚡";   // 40%+
  if (rate >= 0.20) return "🔥";   // 20%+
  if (rate >= 0.08) return "🚀";   // 8%+
  if (rate <= -0.08) return "💣";  // -8% 이하
  return "";
}
function coinKR(m) { return m.replace("KRW-",""); }

/* ===== 1) 상단 실시간 시세 박스 (기존 유지) ===== */
async function renderPriceBox() {
  const ts = document.getElementById("zz-upbit-ts");
  const wrap = document.getElementById("zz-upbit-lines");
  if (!wrap) return;
  ts.textContent = "업데이트: " + new Date().toLocaleString("ko-KR",{hour12:false});
  wrap.innerHTML = "";
  for (const mkt of PRICE_COINS) {
    const px = await getUpbitPrice(mkt);
    wrap.innerHTML += `
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding:8px 0">
        <span>💎 ${coinKR(mkt)}</span><b>${krw(px)}</b>
      </div>`;
  }
}

/* ===== 2) 급등 코인 (8~50%) 패널 ===== */
function ensureMoversPanel() {
  if (document.getElementById("zz-movers")) return;
  const box = document.createElement("div");
  box.id = "zz-movers";
  box.style.cssText = "max-width:920px;margin:18px auto;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.05);font-family:system-ui,Pretendard,sans-serif";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <b>📈 하루 +8% ~ +50% 급등 코인</b>
      <small id="zz-movers-ts" style="color:#64748b"></small>
    </div>
    <div id="zz-movers-list"></div>`;
  const priceBox = document.getElementById("upbit-price-box");
  if (priceBox?.parentNode) priceBox.parentNode.insertBefore(box, priceBox.nextSibling);
  else document.body.appendChild(box);
}

async function renderMovers() {
  ensureMoversPanel();
  const list = document.getElementById("zz-movers-list");
  const ts = document.getElementById("zz-movers-ts");
  if (!list) return;

  const data = await getTickers(MOVERS);
  // 24h 상승률 8%~50% 필터
  const rows = data
    .filter(d => typeof d.signed_change_rate === "number" && d.signed_change_rate >= 0.08 && d.signed_change_rate <= 0.50)
    .sort((a,b) => b.signed_change_rate - a.signed_change_rate)
    .slice(0, 12);

  ts.textContent = "업데이트: " + new Date().toLocaleString("ko-KR",{hour12:false});

  if (rows.length === 0) {
    list.innerHTML = `<div style="color:#94a3b8">현재 조건에 맞는 급등 코인이 없습니다.</div>`;
    return;
  }

  list.innerHTML = rows.map(r => {
    const em = changeEmoji(r.signed_change_rate);
    const color = r.signed_change_rate >= 0 ? "#16a34a" : "#dc2626";
    return `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding:8px 0">
      <span>${em} <b>${coinKR(r.market)}</b></span>
      <span style="color:${color};font-weight:700">${pct(r.signed_change_rate)}</span>
    </div>`;
  }).join("");
}

/* ===== 3) (옵션) 업비트 호가창 — 기본 OFF ===== */
function ensureOrderbookPanel() {
  if (!SHOW_ORDERBOOK) return;
  if (document.getElementById("zz-ob")) return;
  const box = document.createElement("div");
  box.id = "zz-ob";
  box.style.cssText = "max-width:920px;margin:18px auto;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.05);font-family:system-ui,Pretendard,sans-serif";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <b>🧾 업비트 호가창</b>
      <div><label style="font-size:12px;color:#64748b;margin-right:6px">마켓</label>
        <select id="zz-ob-select" style="font-size:14px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px">
          ${PRICE_COINS.map(c=>`<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><div style="display:flex;justify-content:space-between;color:#ef4444;margin-bottom:6px"><span>매도호가</span><small id="zz-ob-ask-total" style="color:#ef4444"></small></div><div id="zz-ob-asks"></div></div>
      <div><div style="display:flex;justify-content:space-between;color:#3b82f6;margin-bottom:6px"><span>매수호가</span><small id="zz-ob-bid-total" style="color:#3b82f6"></small></div><div id="zz-ob-bids"></div></div>
    </div>
    <div style="margin-top:10px;text-align:right"><small id="zz-ob-ts" style="color:#64748b"></small></div>`;
  const priceBox = document.getElementById("upbit-price-box");
  if (priceBox?.parentNode) priceBox.parentNode.insertBefore(box, priceBox.nextSibling);
  else document.body.appendChild(box);
}
async function renderOrderbook() {
  if (!SHOW_ORDERBOOK) return;
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
  const units = (data.orderbook_units || []).slice(0, 15);
  const maxAsk = Math.max(...units.map(u => u.ask_size), 1);
  const maxBid = Math.max(...units.map(u => u.bid_size), 1);
  const bar = (w, color)=>`<span style="display:inline-block;height:16px;width:${Math.min(100,w)}%;background:${color};opacity:.15;border-radius:4px;margin-right:6px;vertical-align:-3px"></span>`;
  const row = (p,s,c)=>`<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #f1f5f9;padding:6px 0">
      <span>${bar((s/(c==="#ef4444"?maxAsk:maxBid))*100,c)}<b style="color:${c}">${p.toLocaleString("ko-KR")}</b></span>
      <span style="color:#64748b">${s.toFixed(3)}</span></div>`;
  const asks = units.slice().reverse();
  const bids = units.slice();
  asksBox.innerHTML = asks.map(u=>row(u.ask_price,u.ask_size,"#ef4444")).join("");
  bidsBox.innerHTML = bids.map(u=>row(u.bid_price,u.bid_size,"#3b82f6")).join("");
  askT.textContent = `총 매도량 ${data.total_ask_size.toFixed(3)}`;
  bidT.textContent = `총 매수량 ${data.total_bid_size.toFixed(3)}`;
  ts.textContent = "업데이트: " + new Date(data.timestamp || Date.now()).toLocaleString("ko-KR",{hour12:false});
}

/* ===== 초기화 ===== */
function init() {
  renderPriceBox();
  setInterval(renderPriceBox, 3000);

  renderMovers();
  setInterval(renderMovers, 5000);

  if (SHOW_ORDERBOOK) {
    ensureOrderbookPanel();
    renderOrderbook();
    setInterval(renderOrderbook, 2000);
    document.addEventListener("change", e => {
      if (e.target && e.target.id === "zz-ob-select") renderOrderbook();
    });
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
