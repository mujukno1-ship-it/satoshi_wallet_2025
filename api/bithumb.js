// api/bithumb.js — Vercel Serverless Function (CORS 해결)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const { fn = "top", n = "15", symbol = "BTC" } = req.query;
  const BASE = "https://api.bithumb.com";

  try {
    if (fn === "all") {
      const r = await fetch(`${BASE}/public/ticker/ALL_KRW`);
      const j = await r.json();
      return res.status(200).json({ ok: j.status === "0000", data: j.data });
    }

    if (fn === "ticker") {
      const r = await fetch(`${BASE}/public/ticker/${encodeURIComponent(symbol)}_KRW`);
      const j = await r.json();
      return res.status(200).json({ ok: j.status === "0000", data: j.data });
    }

    if (fn === "top") {
      const r = await fetch(`${BASE}/public/ticker/ALL_KRW`);
      const j = await r.json();
      if (j.status !== "0000") return res.status(502).json({ ok: false, error: "bithumb bad status" });
      const list = Object.entries(j.data)
        .filter(([k,v]) => k !== "date" && v && v.fluctate_rate_24H)
        .map(([k,v]) => ({
          symbol: k,
          chg: parseFloat(v.fluctate_rate_24H),
          vol: parseFloat(v.acc_trade_value_24H || 0),
          closing_price: parseFloat(v.closing_price || 0)
        }))
        .sort((a,b)=> b.chg - a.chg)
        .slice(0, Number(n) || 15);
      return res.status(200).json({ ok: true, data: list });
    }

    return res.status(400).json({ ok: false, error: "unknown fn" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
