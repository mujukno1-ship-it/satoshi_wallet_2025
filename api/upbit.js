// api/upbit.js
import fetch from "node-fetch";

async function httpJSON(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (r.status === 429) { await new Promise(r => setTimeout(r, 250 + Math.random()*300)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 150 + Math.random()*200)); }
  }
  throw lastErr || new Error("fetch failed");
}

export default async function handler(req, res) {
  try {
    const { fn } = req.query;

    if (fn === "markets") {
      const j = await httpJSON("https://api.upbit.com/v1/market/all?isDetails=true");
      return res.status(200).json({ ok: true, data: j, markets: j });
    }

    if (fn === "candles") {
      const minutes = Number(req.query.minutes || 1);
      const market  = req.query.market || "KRW-BTC";
      const count   = Math.min(Number(req.query.count || 240), 400);
      const url = `https://api.upbit.com/v1/candles/minutes/${minutes}?market=${encodeURIComponent(market)}&count=${count}`;
      const j = await httpJSON(url);
      return res.status(200).json({ ok: true, data: j });
    }

    if (fn === "ticker") {
      const market  = req.query.market || "KRW-BTC";
      const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(market)}`;
      const j = await httpJSON(url);
      return res.status(200).json({ ok: true, data: j?.[0] || null });
    }

    return res.status(400).json({ ok: false, error: "unknown fn" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
