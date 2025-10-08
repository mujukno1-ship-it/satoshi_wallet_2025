// /js/upbit.js — 동일출처 프록시 호출 (시세 + 호가창)

async function callJson(url, { retry = 2 } = {}) {
  for (let i = 0; i <= retry; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP_${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === retry) throw e;
      await new Promise(res => setTimeout(res, 500 * (i + 1)));
    }
  }
}

export async function getUpbitPrice(market = "KRW-BTC") {
  try {
    const j = await callJson(`/api/upbit?market=${encodeURIComponent(market)}`);
    return typeof j?.trade_price === "number" ? j.trade_price : null;
  } catch (e) {
    console.error("[getUpbitPrice] 실패:", e);
    return null;
  }
}

export async function getOrderbook(market = "KRW-BTC") {
  try {
    return await callJson(`/api/orderbook?market=${encodeURIComponent(market)}`);
  } catch (e) {
    console.error("[getOrderbook] 실패:", e);
    return null;
  }
}
