// api/bithumb.js
import fetch from "node-fetch";

async function httpJSON(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.status && j.status !== "0000") throw new Error(`BH err ${j.status}`);
      return j;
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 150 + Math.random()*200)); }
  }
  throw lastErr || new Error("fetch failed");
}

export default async function handler(req, res) {
  try {
    const { fn } = req.query;

    // 모든 KRW 마켓 실시간 (급등용)
    if (fn === "all") {
      const j = await httpJSON("https://api.bithumb.com/public/ticker/ALL_KRW");
      return res.status(200).json({ ok: true, data: j?.data || {} });
    }

    // 단일 심볼 현재가
    if (fn === "ticker") {
      const sym = (req.query.symbol || "BTC").toUpperCase();
      const j = await httpJSON(`https://api.bithumb.com/public/ticker/${sym}_KRW`);
      return res.status(200).json({ ok: true, data: j?.data || null });
    }

    // 1분 캔들 (최대 200)
    if (fn === "candles") {
      const sym = (req.query.symbol || "BTC").toUpperCase();
      const cnt = Math.min(Number(req.query.count || 240), 400);
      const j = await httpJSON(`https://api.bithumb.com/public/candlestick/${sym}_KRW/1m`);
      // 형식: [ timestamp(ms), open, close, high, low, volume ]
      const rows = Array.isArray(j?.data) ? j.data.slice(-cnt) : [];
      return res.status(200).json({ ok: true, data: rows });
    }

    return res.status(400).json({ ok: false, error: "unknown fn" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
