// /js/upbit.js — 업비트 프록시 연결 (CORS 해결용 완전판)

export async function getUpbitPrice(market = "KRW-BTC") {
  try {
    const res = await fetch(`/api/upbit?market=${encodeURIComponent(market)}`);
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = await res.json();
    return data.trade_price || null;
  } catch (err) {
    console.error("❌ 업비트 데이터 불러오기 실패:", err);
    return null;
  }
}
