// /api/bithumb.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { cache: 'no-store' });
    if (!r.ok) throw new Error(`bithumb HTTP ${r.status}`);
    const j = await r.json();

    // j.status === '0000' 이 기본. 방어적으로 체크
    const raw = j?.data || {};
    const items = Object.entries(raw)
      .filter(([k, v]) => k !== 'date' && v && v.closing_price)
      .map(([symbol, v]) => {
        const price = Number(v.closing_price);
        const rate = Number(v.fluctate_rate_24H); // 24H 등락률(%)
        return {
          symbol,
          name: symbol,
          price: isFinite(price) ? price : null,
          ratePercent: isFinite(rate) ? rate : null
        };
      })
      .filter(x => x.price !== null && x.ratePercent !== null)
      .sort((a,b)=>b.ratePercent - a.ratePercent)
      .slice(0, 12);

    return res.status(200).json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, items: [], error: String(e) });
  }
}
