// /js/upbit.js — 동일출처 프록시 호출 모음

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
    // ✅ 배열/객체 모두 지원
    const price = Array.isArray(j) ? j?.[0]?.trade_price : j?.trade_price;
    return typeof price === "number" ? price : null;
  } catch (e) {
    console.error("[getUpbitPrice] 실패:", e);
    return null;
  }
}


export async function getTickers(markets = []) {
  const q = Array.isArray(markets) ? markets.join(",") : String(markets || "");
  if (!q) return [];
  try {
    return await callJson(`/api/tickers?markets=${encodeURIComponent(q)}`);
  } catch (e) {
    console.error("[getTickers] 실패:", e);
    return [];
  }
}

// (선택) 호가창 필요 시 사용
export async function getOrderbook(market = "KRW-BTC") {
  try {
    return await callJson(`/api/orderbook?market=${encodeURIComponent(market)}`);
  } catch (e) {
    console.error("[getOrderbook] 실패:", e);
    return null;
  }
}
