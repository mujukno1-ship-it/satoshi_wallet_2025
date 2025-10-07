export default async function handler(req, res) {
  try {
    const { fn } = req.query;

    if (fn === 'markets') {
      const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store' });
      const j = await r.json();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(j);
    }

    if (fn === 'candles') {
      const { minutes = '1', market = 'KRW-BTC', count = '200' } = req.query;
      const url = `https://api.upbit.com/v1/candles/minutes/${encodeURIComponent(minutes)}?market=${encodeURIComponent(market)}&count=${encodeURIComponent(count)}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('upbit candles fail');
      const j = await r.json();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(j);
    }

    return res.status(400).json({ ok: false, error: 'unknown fn' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
