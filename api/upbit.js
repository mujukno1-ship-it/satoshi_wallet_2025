// api/upbit.js  (Vercel Serverless Function)
export default async function handler(req, res) {
  try {
    const { type = 'ticker', markets = 'KRW-BTC' } = req.query;
    const BASE = 'https://api.upbit.com/v1';

    let url = '';
    if (type === 'ticker') {
      url = `${BASE}/ticker?markets=${encodeURIComponent(markets)}`;
    } else if (type === 'markets' || type === 'market') {
      url = `${BASE}/market/all?isDetails=false`;
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const up = await fetch(url, { headers: { accept: 'application/json' } });
    if (!up.ok) {
      const txt = await up.text().catch(()=> '');
      return res.status(502).json({ error: `Upbit ${up.status}`, body: txt });
    }

    const data = await up.json();

    // Vercel 캐시: 빠르게, 그리고 부하 적게
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Upbit fetch failed' });
  }
}
