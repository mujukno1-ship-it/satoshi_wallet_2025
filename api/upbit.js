// api/upbit.js
const BASE = "https://api.upbit.com/v1";

export default async function handler(req, res) {
  try {
    const { type, markets, fn, minutes = "1" } = req.query;

    const cacheHeaders = {
      "Cache-Control": "s-maxage=5, stale-while-revalidate=25",
      "Content-Type": "application/json; charset=utf-8",
    };

    // ---- 분봉 캔들 ----
    if (fn === "candles") {
      if (!markets) {
        res.writeHead(400, cacheHeaders);
        return res.end(JSON.stringify({ ok: false, error: "market(required)" }));
      }
      const url = `${BASE}/candles/minutes/${encodeURIComponent(
        minutes
      )}?market=${encodeURIComponent(markets)}`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await r.json();
      res.writeHead(200, cacheHeaders);
      return res.end(JSON.stringify({ ok: true, data }));
    }

    // ---- 거래대금 상위 TOP ----
    if (fn === "top") {
      const r1 = await fetch(`${BASE}/market/all?isDetails=false`, {
        headers: { Accept: "application/json" },
      });
      const all = await r1.json();
      const krw = all.filter((x) => x.market.startsWith("KRW-"));

      const list = krw.map((x) => x.market).join(",");
      const r2 = await fetch(`${BASE}/ticker?markets=${encodeURIComponent(list)}`, {
        headers: { Accept: "application/json" },
      });
      const tickers = await r2.json();

      const sorted = tickers
        .sort((a, b) => (b.acc_trade_price_24h || 0) - (a.acc_trade_price_24h || 0))
        .slice(0, 20);

      res.writeHead(200, cacheHeaders);
      return res.end(JSON.stringify({ ok: true, data: sorted }));
    }

    // ---- 기본 ticker or markets ----
    let url = null;
    if (type === "ticker" && markets) {
      url = `${BASE}/ticker?markets=${encodeURIComponent(markets)}`;
    } else if (type === "markets") {
      url = `${BASE}/market/all?isDetails=false`;
    } else {
      res.writeHead(400, cacheHeaders);
      return res.end(JSON.stringify({ ok: false, error: "Invalid query" }));
    }

    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await r.json();
    res.writeHead(200, cacheHeaders);
    return res.end(JSON.stringify({ ok: true, data }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
}
