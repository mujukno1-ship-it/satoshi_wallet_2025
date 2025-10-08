// api/upbit.js — 업비트 현재가 유틸 (기존 HTML 안 건드림)
export async function getUpbitPrice(market = "KRW-BTC") {
  const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(market)}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return typeof data?.[0]?.trade_price === "number" ? data[0].trade_price : null;
  } catch (e) {
    console.error("❌ 업비트 시세 오류:", e);
    return null;
  }
}
