// /api/upbit.js
export default async function handler(req, res) {
  try {
    const { type, markets = "" } = req.query || {};
    const BASE = "https://api.upbit.com/v1";

    let url = "";
    if (type === "ticker" && markets) {
      url = `${BASE}/ticker?markets=${encodeURIComponent(markets)}`;
    } else if (type === "markets" || type === "market") {
      url = `${BASE}/market/all?isDetails=false`;
    } else {
      return res.status(400).json({ error: "invalid type" });
    }

    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(r.status).json({ error: `upbit ${r.status}` });

    const data = await r.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
