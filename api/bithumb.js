// /api/upbit.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const mres = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store' });
    if (!mres.ok) throw new Error(`upbit markets HTTP ${mres.status}`);
    const markets = await mres.json();
    const krw = markets.filter(m => m.market && m.market.startsWith('KRW-')).slice(0, 80);
    const marketsParam = krw.map(m => m.market).join(',');

    const tres = await fetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(marketsParam)}`, { cache: 'no-store' });
    if (!tres.ok) throw new Error(`upbit ticker HTTP ${tres.status}`);
    const tickers = await tres.json();

    const nameMap = new Map(krw.map(m => [m.market, m.korean_name || m.market]));

    const items = (tickers || []).map(t => ({
      symbol: (t.market || '').replace('KRW-',''),
      name: nameMap.get(t.market) || (t.market || '').replace('KRW-',''),
      price: Number(t.trade_price || 0),
      ratePercent: Number(t.signed_change_rate || 0) * 100
    }))
    .filter(x => isFinite(x.price))
    .sort((a,b)=> (b.ratePercent||0) - (a.ratePercent||0))
    .slice(0, 12);

    return res.status(200).json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, items: [], error: String(e) });
  }
}
