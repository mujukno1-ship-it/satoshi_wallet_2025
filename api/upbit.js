// /api/upbit.js — 업비트 시세 프록시 (Vercel Serverless)
export default async function handler(req, res) {
  const market = (req.query.market || "KRW-BTC").toString();
  try {
    const r = await fetch(
      `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(market)}`,
      { headers: { accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`UPBIT_HTTP_${r.status}`);
    const arr = await r.json();
    const x = arr?.[0] ?? {};
    res.status(200).json({
      market,
      trade_price: x.trade_price ?? null,
      change: x.change ?? null,
      signed_change_rate: x.signed_change_rate ?? null,
      ts: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: "UPBIT_FETCH_FAILED", detail: String(e) });
  }
}
