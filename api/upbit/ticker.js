export default async function handler(req, res) {
  const markets = (req.query.markets || req.query.market || "").toString().toUpperCase().trim();
  if (!markets) return res.status(400).json({ ok: false, error: "markets required" });

  try {
    const url = "https://api.upbit.com/v1/ticker?markets=" + encodeURIComponent(markets);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(r.status).json({ ok: false });
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=3, stale-while-revalidate=30");
    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
