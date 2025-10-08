// /js/upbit.js — 프론트엔드에서 Vercel API 호출
export async function getUpbitPrice(market = "KRW-BTC") {
  try {
    const r = await fetch(`/api/upbit?market=${encodeURIComponent(market)}`);
    if (!r.ok) throw new Error(`HTTP_${r.status}`);
    const j = await r.json();
    return j?.trade_price ?? null;
  } catch (e) {
    console.error("업비트 시세 실패:", e);
    return null;
  }
}
