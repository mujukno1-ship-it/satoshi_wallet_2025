// /api/upbit.js  (Vercel Serverless)
export default async function handler(req, res) {
  // CORS 허용
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(204).end();
  }
  const send = (code, body) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    res.status(code).json(body);
  };

  const { fn } = req.query;
  try {
    if (fn === "ping") return send(200, { ok: true, pong: true });

    if (fn === "markets") {
      const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=true");
      const data = await r.json();
      return send(200, { ok: true, markets: data });
    }

    if (fn === "ticker") {
      const markets = req.query.markets || "";
      const r = await fetch("https://api.upbit.com/v1/ticker?markets=" + markets);
      const data = await r.json();
      return send(200, { ok: true, data });
    }

    if (fn === "candles") {
      const minutes = req.query.minutes || "1";
      const market  = req.query.market;
      const count   = req.query.count || "200";
      if (!market) return send(400, { ok: false, error: "market required" });
      const url = `https://api.upbit.com/v1/candles/minutes/${minutes}?market=${market}&count=${count}`;
      const r = await fetch(url);
      const data = await r.json();
      return send(200, { ok: true, data });
    }

    if (fn === "top") {
      const n = Number(req.query.n || 15);
      const rAll = await fetch("https://api.upbit.com/v1/market/all?isDetails=true");
      const mk = await rAll.json();
      const krw = mk.filter(x => x.market.startsWith("KRW-")).slice(0, 150);

      // ticker는 100개 단위로 나눠서 요청
      const chunks = [];
      for (let i = 0; i < krw.length; i += 100) {
        chunks.push(krw.slice(i, i + 100).map(x => x.market).join(","));
      }
      const tickers = [];
      for (const chunk of chunks) {
        const r = await fetch("https://api.upbit.com/v1/ticker?markets=" + chunk);
        const t = await r.json();
        tickers.push(...t);
      }

      tickers.sort((a, b) => (b.signed_change_rate || 0) - (a.signed_change_rate || 0));
      const data = tickers.slice(0, n).map(x => ({
        market: x.market,
        signed_change_rate: x.signed_change_rate,
        acc_trade_price_24h: x.acc_trade_price_24h
      }));
      return send(200, { ok: true, data });
    }

    return send(400, { ok: false, error: "unknown fn" });
  } catch (e) {
    return send(500, { ok: false, error: String(e) });
  }
}
