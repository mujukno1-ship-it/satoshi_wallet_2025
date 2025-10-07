// /api/upbit.js  — Vercel Serverless (Node 18+, global fetch 사용)

async function httpJSON(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (r.status === 429) {
        await new Promise(r => setTimeout(r, 250 + Math.random() * 300));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
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

    if (fn === "markets") {
      const j = await httpJSON("https://api.upbit.com/v1/market/all?isDetails=true");
      return res.status(200).json({ ok: true, data: j });
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
      return res.status(200).json({ ok: true, data: Array.isArray(j) ? j[0] : null });
    }

    if (fn === "tickersKRW") {
      const mk = await httpJSON("https://api.upbit.com/v1/market/all?isDetails=true");
      const krw = (mk || []).filter(x => (x.market || "").startsWith("KRW-")).map(x => x.market);
      let out = [];
      for (let i = 0; i < krw.length; i += 100) {
        const chunk = krw.slice(i, i + 100).join(",");
        const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(chunk)}`;
        const j = await httpJSON(url);
        if (Array.isArray(j)) out = out.concat(j);
      }
      return res.status(200).json({ ok: true, data: out });
    }

    return res.status(400).json({ ok: false, error: "unknown fn" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
