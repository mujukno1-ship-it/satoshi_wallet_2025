/**  /api/upbit
 *   ?fn=markets
 *   ?fn=candles&minutes=1&market=KRW-BTC&count=240
 *   ?fn=top&n=10
 */
export default async function handler(req, res) {
  try {
    const { fn } = req.query;

    if (fn === 'markets') {
      const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store' });
      const j = await r.json();
      return send(res, 200, j);
    }

    if (fn === 'candles') {
      const { minutes = '1', market = 'KRW-BTC', count = '200' } = req.query;
      const url = `https://api.upbit.com/v1/candles/minutes/${encodeURIComponent(minutes)}?market=${encodeURIComponent(market)}&count=${encodeURIComponent(count)}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('upbit candles fail');
      const j = await r.json();
      return send(res, 200, j);
    }

    if (fn === 'top') {
      const n = Number(req.query.n || 10);
      // 1) KRW-마켓만 추출
      const mr = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store' });
      const marketsAll = await mr.json();
      const krw = marketsAll
        .filter(m => (m.market || '').startsWith('KRW-'))
        .map(m => m.market);

      // 2) ticker를 90개씩 끊어서 조회
      const chunks = [];
      for (let i = 0; i < krw.length; i += 90) chunks.push(krw.slice(i, i + 90));
      const results = [];
      for (const c of chunks) {
        const url = 'https://api.upbit.com/v1/ticker?markets=' + encodeURIComponent(c.join(','));
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) continue;
        const arr = await r.json();
        for (const t of arr) {
          results.push({
            market: t.market,
            sym: (t.market || '').replace('KRW-', ''),
            chg: Number(t.signed_change_rate || 0) * 100,
            vol: Number(t.acc_trade_price_24h || 0)
          });
        }
      }
      results.sort((a, b) => b.chg - a.chg);
      return send(res, 200, results.slice(0, n));
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
