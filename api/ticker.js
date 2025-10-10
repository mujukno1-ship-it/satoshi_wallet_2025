export default async function handler(req, res) {
  try {
    const { market } = req.query;
    if (!market) return res.status(400).json({ error: "market required" });

    const r = await fetch(
      "https://api.upbit.com/v1/ticker?markets=" + encodeURIComponent(market),
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) return res.status(r.status).json({ error: "upbit "+r.status });
    const data = await r.json();

    // 초단기 캐시 (틱 데이터는 짧게)
    res.setHeader("Cache-Control", "public, s-maxage=2, stale-while-revalidate=1");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
