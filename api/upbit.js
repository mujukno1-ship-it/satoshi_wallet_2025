export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, max-age=0, s-maxage=0',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const markets = [
      'KRW-BTC','KRW-ETH','KRW-XRP','KRW-SOL','KRW-ADA','KRW-DOGE','KRW-SHIB',
      'KRW-TRX','KRW-DOT','KRW-MATIC','KRW-LINK','KRW-ATOM','KRW-APT','KRW-AVAX'
    ];
    const url = 'https://api.upbit.com/v1/ticker?markets=' +
                encodeURIComponent(markets.join(','));
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();

    const items = (Array.isArray(j) ? j : [])
      .map(t => ({
        symbol: (t.market || '').replace('KRW-',''),
        name: (t.korean_name || t.market || '').replace('KRW-',''),
        price: Number(t.trade_price),
        ratePercent: Number(t.signed_change_rate) * 100
      }))
      .sort((a,b) => b.ratePercent - a.ratePercent)
      .slice(0, 12);

    return new Response(JSON.stringify({ ok: true, items }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, items: [], error: String(e) }), { headers });
  }
}
