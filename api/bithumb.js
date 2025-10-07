export default async function handler(req, res) {
  try {
    const { fn } = req.query;
    if (fn === 'all') {
      const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { cache: 'no-store' });
      if (!r.ok) throw new Error('bithumb fail');
      const j = await r.json();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(j);
    }
    return res.status(400).json({ ok: false, error: 'unknown fn' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
