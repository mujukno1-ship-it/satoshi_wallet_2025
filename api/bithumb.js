// /api/bithumb.js — Vercel Serverless

async function httpJSON(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.status && j.status !== "0000") throw new Error(`BH err ${j.status}`);
      return j;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 150 + Math.random() * 200));
    }
  }
  throw lastErr || new Error("fetch failed");
}

module.exports = async (req, res) => {
  try {
    const { fn } = req.query || {};

    if (fn === "all") {
      const j = await httpJSON("https://api.bithumb.com/public/ticker/ALL_KRW");
      return res.status(200).json({ ok: true, data: j?.data || {} });
    }

    if (fn === "ticker") {
      const sym = (req.query.symbol || "BTC").toUpperCase();
      const j = await httpJSON(`https://api.bithumb.com/public/ticker/${sym}_KRW`);
      return res.status(200).json({ ok: true, data: j?.data || null });
    }

    if (fn === "candles") {
      const sym = (req.query.symbol || "BTC").toUpperCase();
      const cnt = Math.min(Number(req.query.count || 240), 400);
      const j = await httpJSON(`https://api.bithumb.com/public/candlestick/${sym}_KRW/1m`);
      const rows = Array.isArray(j?.data) ? j.data.slice(-cnt) : [];
      // [ ts(ms), open, close, high, low, volume ]
      return res.status(200).json({ ok: true, data: rows });
    }

    return res.status(400).json({ ok: false, error: "unknown fn" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
