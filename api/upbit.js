import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const url = "https://api.upbit.com/v1/ticker/all";
    const response = await fetch(url);
    const data = await response.json();

    const items = data
      .filter((coin) => coin.market.startsWith("KRW-"))
      .map((coin) => ({
        exchange: "업비트",
        symbol: coin.market,
        name: coin.korean_name || coin.market.replace("KRW-", ""),
        price: Number(coin.trade_price).toLocaleString("ko-KR"),
        changeRate: (coin.signed_change_rate * 100).toFixed(2) + "%",
        risk:
          Math.abs(coin.signed_change_rate * 100) > 5
            ? "🚨 급등"
            : "보통",
      }))
      .slice(0, 30);

    res.status(200).json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
