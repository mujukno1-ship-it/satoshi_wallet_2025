// /api/market/all
export default async function handler(req, res) {
  try {
    const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
      headers: { 'Accept': 'application/json' }
    });
    if (!r.ok) return res.status(r.status).send('upbit market/all error');
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
