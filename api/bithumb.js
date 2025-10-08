// /api/bithumb.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { cache: 'no-store' });
    if (!r.ok) throw new Error(`bithumb HTTP ${r.status}`);
    const j = await r.json();

    const raw = j?.data || {};
    const items = Object.entries(raw)
      .filter(([k,v]) => k !== 'date' && v && (v.closing_price || v.closing_price === 0))
      .map(([symbol, v]) => {
        const price = Number(v.closing_price);
        // 빗썸은 24H 등락률 필드가 fluctuate_rate_24H 또는 fluctuate_rate 인 경우가 있음
        const rate = (v.fluctate_rate_24H !== undefined)
          ? Number(v.fluctate_rate_24H)
          : Number(v.fluctate_rate ?? 0);

        return {
          symbol,
          name: symbol,
          price: isFinite(price) ? price : null,
          ratePercent: isFinite(rate) ? rate : null
        };
      })
      .filter(x => x.price !== null && x.ratePercent !== null)
      .sort((a,b)=> (b.ratePercent||0) - (a.ratePercent||0))
      .slice(0, 12);

    return res.status(200).json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, items: [], error: String(e) });
  }
}
