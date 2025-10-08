// /api/orderbook.js — 업비트 호가창 프록시 (Vercel Serverless)
export default async function handler(req, res) {
  const market = (req.query.market || "KRW-BTC").toString();
  try {
    const r = await fetch(
      `https://api.upbit.com/v1/orderbook?markets=${encodeURIComponent(market)}`,
      { headers: { accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`UPBIT_HTTP_${r.status}`);
    const arr = await r.json();
    const x = arr?.[0] ?? {};
    res.status(200).json({
      market: x.market || market,
      total_ask_size: x.total_ask_size ?? 0,
      total_bid_size: x.total_bid_size ?? 0,
      timestamp: x.timestamp ?? Date.now(),
      orderbook_units: (x.orderbook_units || []).map(u => ({
        ask_price: u.ask_price,
        bid_price: u.bid_price,
        ask_size: u.ask_size,
        bid_size: u.bid_size
      }))
    });
  } catch (e) {
    res.status(500).json({ error: "ORDERBOOK_FAILED", detail: String(e) });
  }
}
