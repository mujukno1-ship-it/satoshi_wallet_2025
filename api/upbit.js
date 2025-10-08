// api/upbit.js — 업비트 실시간 시세 불러오기
export async function getUpbitPrice(market = "KRW-BTC") {
  const url = `https://api.upbit.com/v1/ticker?markets=${market}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0].trade_price; // 현재가
  } catch (err) {
    console.error("❌ 업비트 시세 오류:", err);
    return null;
  }
}
