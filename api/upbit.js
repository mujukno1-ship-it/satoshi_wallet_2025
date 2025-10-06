export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const { fn = "ticker", market = "KRW-BTC", minutes = "1", count = "120", n = "15" } = req.query;
  const BASE = "https://api.upbit.com/v1";
  const headers = { Accept: "application/json" };
  try {
    if (fn === "markets") {
      const r = await fetch(`${BASE}/market/all?isDetails=false`, { headers });
      const data = await r.json();
      const krw = data.filter(x => x.market && x.market.startsWith("KRW-"));
      res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=25");
      return res.status(200).json({ ok: true, markets: krw });
    }
    if (fn === "ticker") {
      const r = await fetch(`${BASE}/ticker?markets=${encodeURIComponent(market)}`, { headers });
      const data = await r.json();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, data });
    }
    if (fn === "candles") {
      const url = `${BASE}/candles/minutes/${minutes}?market=${encodeURIComponent(market)}&count=${count}`;
      const r = await fetch(url, { headers });
      const data = await r.json();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, data });
    }
    if (fn === "top") {
      const list = await (await fetch(`${BASE}/market/all?isDetails=false`, { headers })).json();
      const krw = list.filter(x => x.market && x.market.startsWith("KRW-")).map(x => x.market).slice(0, 120);
      const tickers = await (await fetch(`${BASE}/ticker?markets=${krw.join(",")}`, { headers })).json();
      const sorted = tickers.sort((a,b)=> (b.acc_trade_price_24h||0)-(a.acc_trade_price_24h||0)).slice(0, Number(n)||15);
      res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=25");
      return res.status(200).json({ ok: true, data: sorted });
    }
    return res.status(400).json({ ok: false, error: "unknown fn" });
  } catch (e) { return res.status(500).json({ ok: false, error: String(e) }); }
}