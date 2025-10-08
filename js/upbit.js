// /js/upbit.js — 동일출처 프록시(/api/upbit) 호출
export async function getUpbitPrice(market = "KRW-BTC") {
  try {
    const res = await fetch(`/api/upbit?market=${encodeURIComponent(market)}`, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const j = await res.json();
    return typeof j?.trade_price === "number" ? j.trade_price : null;
  } catch (err) {
    console.error("❌ 업비트 시세 실패:", err);
    return null;
  }
}
