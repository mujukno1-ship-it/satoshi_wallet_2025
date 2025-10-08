export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');

  try {
    const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW');
    const j = await r.json();
    const data = j.data;

    const items = Object.entries(data)
      .filter(([k, v]) => k !== 'date' && v && v.fluctate_rate_24H)
      .map(([symbol, v]) => ({
        symbol,
        price: Number(v.closing_price),
        ratePercent: Number(v.fluctate_rate_24H)
      }))
      .sort((a, b) => b.ratePercent - a.ratePercent)
      .slice(0, 12);

    res.status(200).json({ ok: true, items });
  } catch (e) {
    res.status(200).json({ ok: false, items: [], error: String(e) });
  }
}
