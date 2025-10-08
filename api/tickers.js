// /api/tickers.js — 업비트 다중 티커 프록시 (24h 변동률/가격)
export default async function handler(req, res) {
  const markets = (req.query.markets || "KRW-BTC,KRW-ETH").toString();
  const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`;
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`UPBIT_HTTP_${r.status}`);
    const arr = await r.json();
    // 필요한 필드만 간추려서 반환
    const out = arr.map(x => ({
      market: x.market,
      trade_price: x.trade_price,
      change: x.change,                         // "RISE" | "FALL" | "EVEN"
      signed_change_rate: x.signed_change_rate, // 예: 0.1234  => 12.34%
      acc_trade_price_24h: x.acc_trade_price_24h
    }));
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "TICKERS_FAILED", detail: String(e) });
  }
}
