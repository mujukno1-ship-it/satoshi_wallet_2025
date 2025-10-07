export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const fn = (req.query.fn || '').toString();

  try {
    if (fn === 'markets') {
      // 업비트 전체 마켓
      const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store' });
      const j = await r.json();
      return res.status(200).json(j);
    }

    if (fn === 'candles') {
      // 분봉 캔들: /api/upbit?fn=candles&minutes=1&market=KRW-BTC&count=200
      const minutes = Number(req.query.minutes || 1);
      const market  = (req.query.market || 'KRW-BTC').toString();
      const count   = Number(req.query.count || 200);
      const url = `https://api.upbit.com/v1/candles/minutes/${minutes}?market=${encodeURIComponent(market)}&count=${count}`;
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      return res.status(200).json(j);
    }

    if (fn === 'top') {
      // 실시간 급등 TOP: /api/upbit?fn=top&n=8
      const N = Math.max(1, Math.min(50, Number(req.query.n || 8)));

      // 1) KRW 마켓 목록
      const mr = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store' });
      const marketsAll = await mr.json();
      const krw = (marketsAll || []).filter(m => (m.market || '').startsWith('KRW-'));
      const marketCodes = krw.map(m => m.market);

      // 2) 티커 조회 (여러개를 ,로 합쳐 요청). 업비트는 한 번에 긴 쿼리도 잘 받습니다만 안전하게 청크.
      const chunk = (arr, n) => arr.reduce((a,_,i) => (i % n ? a : [...a, arr.slice(i, i+n)]), []);
      const groups = chunk(marketCodes, 100); // 100개씩
      const tickerResults = [];
      for (const g of groups) {
        const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(g.join(','))}`;
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json();
        if (Array.isArray(j)) tickerResults.push(...j);
      }

      // 3) 정렬 (24h 변동률 기준). acc_trade_price_24h도 함께 반환
      const mapName = new Map(krw.map(m => [m.market, m.korean_name]));
      const rows = tickerResults.map(t => ({
        market: t.market,
        name: mapName.get(t.market) || t.market.replace('KRW-',''),
        chg: (t.signed_change_rate || 0) * 100,
        acc_trade_price_24h: t.acc_trade_price_24h || 0
      }))
      .sort((a,b) => b.chg - a.chg)
      .slice(0, N);

      return res.status(200).json({ data: rows });
    }

    // 기본: 도움말
    return res.status(400).json({
      error: 'unknown_fn',
      howto: [
        '/api/upbit?fn=markets',
        '/api/upbit?fn=candles&minutes=1&market=KRW-BTC&count=200',
        '/api/upbit?fn=top&n=8'
      ]
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'fetch_failed' });
  }
}
