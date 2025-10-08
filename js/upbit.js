// js/upbit.js — CORS 프록시 우회 버전
export async function getUpbitPrice(market = "KRW-BTC") {
  const proxy = "https://api.allorigins.win/raw?url=";
  const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(market)}`;

  try {
    const res = await fetch(proxy + encodeURIComponent(url));
    const data = await res.json();
    return data[0]?.trade_price ?? null;
  } catch (err) {
    console.error("업비트 시세 불러오기 실패:", err);
    return null;
  }
}
