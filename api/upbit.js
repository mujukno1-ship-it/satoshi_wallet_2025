
// api/upbit.js
export default async function handler(req, res) {
  const { market } = req.query; // 예: KRW-BTC

  try {
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`);
    const data = await response.json();

    if (!data || data.error) {
      throw new Error('업비트 API 호출 실패');
    }

    const ticker = data[0];
    res.status(200).json({
      market: ticker.market,
      trade_price: ticker.trade_price,
      high_price: ticker.high_price,
      low_price: ticker.low_price,
      acc_trade_price_24h: ticker.acc_trade_price_24h,
    });
  } catch (error) {
    console.error("⚠️ 업비트 API 오류:", error);
    res.status(500).json({ error: "업비트 API 호출 실패" });
  }
}
