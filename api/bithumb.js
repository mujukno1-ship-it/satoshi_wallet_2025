export default async function handler(req, res) {
  // CORS/캐시 끔
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');

  try {
    const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { cache: 'no-store' });
    const j = await r.json();
    if (j?.status !== '0000' || !j?.data) {
      res.status(200).json({ ok:false, items:[] });
      return;
    }

    const items = Object.entries(j.data)
      .filter(([k,v]) => k !== 'date' && v && v.closing_price)
      .map(([symbol, v]) => ({
        symbol,
        name: symbol,
        price: Number(v.closing_price),
        ratePercent: Number(v.fluctate_rate_24H) // 문자열 → 숫자
      }))
      .sort((a,b) => b.ratePercent - a.ratePercent)
      .slice(0, 12);

    res.status(200).json({ ok: true, items });
  } catch (e) {
    res.status(200).json({ ok:false, items:[], error:String(e) });
  }
}
