export default async function handler(req, res) {
  // CORS/캐시 끔
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');

  try {
    // KRW 주요마켓만 빠르게 조회 (상승률 상위 정렬)
    const markets = [
      'KRW-BTC','KRW-ETH','KRW-XRP','KRW-SOL','KRW-ADA','KRW-DOGE','KRW-SHIB',
      'KRW-TRX','KRW-DOT','KRW-MATIC','KRW-LINK','KRW-ATOM','KRW-NEO','KRW-APT',
      'KRW-XLM','KRW-ARB','KRW-AVAX','KRW-PEPE','KRW-OP'
    ];
    const url = 'https://api.upbit.com/v1/ticker?markets=' + encodeURIComponent(markets.join(','));
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();

    const items = (Array.isArray(j) ? j : []).map(t => ({
      symbol: (t.market || '').replace('KRW-',''),
      name: (t.korean_name || t.market || '').replace('KRW-',''),
      price: Number(t.trade_price),
      signed_change_rate: Number(t.signed_change_rate), // 0.031 → 3.1%
      ratePercent: Number(t.signed_change_rate) * 100
    }))
    .sort((a,b) => b.ratePercent - a.ratePercent)
    .slice(0, 12);

    res.status(200).json({ ok: true, items });
  } catch (e) {
    res.status(200).json({ ok: false, items: [], error: String(e) });
  }
}
