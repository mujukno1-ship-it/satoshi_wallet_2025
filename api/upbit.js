// api/upbit.js
const BASE = "https://api.upbit.com/v1";

export default async function handler(req, res) {
  try {
    const { type, markets, fn, minutes = "1" } = req.query;

    const headers = {
      "Cache-Control": "s-maxage=5, stale-while-revalidate=25",
      "Content-Type": "application/json; charset=utf-8",
    };

    if (fn === "candles") {
      if (!markets) {
        res.writeHead(400, headers);
        return res.end(JSON.stringify({ ok: false, error: "market(required)" }));
      }
      const url = `${BASE}/candles/minutes/${minutes}?market=${encodeURIComponent(markets)}`;
      const r = await fetch(url);
      const data = await r.json();
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ ok: true, data }));
    }

    if (fn === "top") {
      const allMarkets = await fetch(`${BASE}/market/all?isDetails=false`).then(r => r.json());
      const krwMarkets = allMarkets.filter(m => m.market.startsWith("KRW-"));
      const list = krwMarkets.map(m => m.market).join(",");
      const tickerData = await fetch(`${BASE}/ticker?markets=${encodeURIComponent(list)}`).then(r => r.json());
      const sorted = tickerData
        .sort((a, b) => (b.acc_trade_price_24h || 0) - (a.acc_trade_price_24h || 0))
        .slice(0, 20);
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ ok: true, data: sorted }));
    }

    let url = "";
    if (type === "ticker" && markets) {
      url = `${BASE}/ticker?markets=${encodeURIComponent(markets)}`;
    } else if (type === "markets") {
      url = `${BASE}/market/all?isDetails=false`;
    } else {
      res.writeHead(400, headers);
      return res.end(JSON.stringify({ ok: false, error: "Invalid query" }));
    }

    const r = await fetch(url);
    const data = await r.json();
    res.writeHead(200, headers);
    return res.end(JSON.stringify({ ok: true, data }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
}
