export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.upbit.com/v1/market/all?isDetails=false", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const markets = await response.json();
    const krwMarkets = markets.filter((m) => m.market.startsWith("KRW-")).slice(0, 10);

    // 요청 속도 조절
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const prices = [];

    for (const m of krwMarkets) {
      await delay(250); // 0.25초 간격 (초당 4회 이하)
      const ticker = await fetch(`https://api.upbit.com/v1/ticker?markets=${m.market}`);
      const data = await ticker.json();
      prices.push({ symbol: m.korean_name, price: data[0].trade_price });
    }

    res.status(200).json({ ok: true, items: prices });
  } catch (e) {
    res.status(429).json({ error: e.message });
  }
}
