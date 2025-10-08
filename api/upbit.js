// /api/upbit.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // 1) 마켓 목록 (한글명 매핑용)
    const mres = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store' });
    if (!mres.ok) throw new Error(`upbit markets HTTP ${mres.status}`);
    const markets = await mres.json();

    // KRW-마켓 60개 정도만 사용 (필요 이상이면 잘라냄)
    const krw = markets.filter(m => m.market.startsWith('KRW-')).slice(0, 60);
    const marketsParam = krw.map(m => m.market).join(',');

    // 2) 한 번에 시세 조회 (429 회피)
    const tres = await fetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(marketsParam)}`, { cache: 'no-store' });
    if (!tres.ok) throw new Error(`upbit ticker HTTP ${tres.status}`);
    const tickers = await tres.json();

    // 한글명 맵
    const nameMap = new Map(krw.map(m => [m.market, m.korean_name]));

    const items = tickers.map(t => ({
      symbol: t.market.replace('KRW-',''),
      name: nameMap.get(t.market) || t.market.replace('KRW-',''),
      price: Number(t.trade_price),
      ratePercent: Number(t.signed_change_rate) * 100
    }))
    .sort((a,b)=>b.ratePercent - a.ratePercent)
    .slice(0, 12);

    return res.status(200).json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, items: [], error: String(e) });
  }
}
