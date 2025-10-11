// api/market/all.js
export default async function handler(req, res) {
  try {
    const r = await fetch(
      'https://api.upbit.com/v1/market/all?isDetails=false',
      { headers: { Accept: 'application/json' } }
    );

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'upbit_error', body: text });
    }

    const data = await r.json();

    // 캐시(엣지/CDN) — 업비트 목록은 자주 안 바뀌므로 가볍게 캐싱
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
