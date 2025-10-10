// /js/upbit.js  — 공용 REST 호출 + 검색용 API

async function callJson(url, { retry = 2 } = {}) {
  for (let i = 0; i <= retry; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP_${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === retry) throw e;
      await new Promise(res => setTimeout(res, 400 * (i + 1)));
    }
  }
}

// 단일 코인 현재가 (market: "KRW-BTC" 등)
export async function getUpbitPrice(market = "KRW-BTC") {
  try {
    const j = await callJson(`/api/upbit?market=${encodeURIComponent(market)}`);
    // 배열/객체 모두 지원
    return typeof j?.trade_price === "number" ? j.trade_price : j?.[0]?.trade_price ?? null;
  } catch (e) {
    console.error("[getUpbitPrice] 실패:", e);
    return null;
  }
}

// 여러 코인 시세 (markets: ["KRW-BTC","KRW-ETH"] 등)
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
