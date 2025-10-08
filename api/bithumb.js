export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.bithumb.com/public/ticker/ALL_KRW");
    const data = await response.json();

    if (!data || !data.data) {
      return res.status(500).json({ error: "Invalid response from Bithumb API" });
    }

    const items = Object.entries(data.data)
      .filter(([symbol]) => symbol !== "date")
      .map(([symbol, info]) => ({
        exchange: "빗썸",
        symbol: `KRW-${symbol}`,
        name: symbol,
        price: info.closing_price,
        changeRate: info.fluctate_rate_24H,
        high: info.max_price,
        low: info.min_price,
        bid: info.buy_price,
        ask: info.sell_price,
        risk: "보통",
      }));

    res.status(200).json({ exchange: "빗썸", items });
  } catch (error) {
    console.error("⚠️ Bithumb fetch error:", error);
    res.status(500).json({ error: "서버 오류 발생" });
  }
}
