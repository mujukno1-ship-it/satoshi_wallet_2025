export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, s-maxage=0');

  try {
    const markets = [
      'KRW-BTC','KRW-ETH','KRW-XRP','KRW-SOL','KRW-ADA','KRW-DOGE','KRW-SHIB',
      'KRW-TRX','KRW-DOT','KRW-MATIC','KRW-LINK','KRW-ATOM','KRW-NEO','KRW-APT'
    ];
    const url = 'https://api.upbit.com/v1/ticker?markets=' + markets.join(',');
    const r = await fetch(url);
    const j = await r.json();

    const items = j.map(t => ({
      symbol: (t.market || '').replace('KRW-',''),
      price: Number(t.trade_price),
      ratePercent: (t.signed_change_rate * 100).toFixed(2)
    })).sort((a,b) => b.ratePercent - a.ratePercent).slice(0, 12);

    res.status(200).json({ ok: true, items });
  } catch (e) {
    res.status(200).json({ ok: false, items: [], error: String(e) });
  }
}
