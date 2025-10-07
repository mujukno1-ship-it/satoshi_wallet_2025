/** /api/bithumb
 *   ?fn=all
 *   ?fn=top&n=10
 */
export default async function handler(req, res) {
  try {
    const { fn } = req.query;

    if (fn === 'all') {
      const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { cache: 'no-store' });
      const j = await r.json();
      return send(res, 200, j);
    }

    if (fn === 'top') {
      const n = Number(req.query.n || 10);
      const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { cache: 'no-store' });
      const j = await r.json();
      const arr = Object.entries(j?.data || {})
        .filter(([k, v]) => k !== 'date' && v && v.fluctate_rate_24H)
        .map(([k, v]) => ({
          sym: String(k).toUpperCase(),
          chg: Number(v.fluctate_rate_24H || 0),
          vol: Number(v.acc_trade_value_24H || 0)
        }))
        .sort((a, b) => b.chg - a.chg)
        .slice(0, n);
      return send(res, 200, arr);
    }

    return send(res, 400, { ok: false, error: 'unknown fn' });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e) });
  }
}

function send(res, code, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(data);
}
