// api/bithumb.js
export default async function handler(req, res) {
  try {
    const { path, symbol } = req.query;

    if (path === 'orderbook') {
      // ex) /api/bithumb?path=orderbook&symbol=MIX
      const url = `https://api.bithumb.com/public/orderbook/${symbol}_KRW`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const j = await r.json();
      if (j.status !== '0000') throw new Error('Bithumb orderbook error');

      // 표준화
      const asks = (j.data.asks || []).map(a => ({
        price: Number(a.price),
        qty: Number(a.quantity)
      }));
      const bids = (j.data.bids || []).map(b => ({
        price: Number(b.price),
        qty: Number(b.quantity)
      }));
      return res.status(200).json({ asks, bids, ts: Date.now() });
    }

    if (path === 'top-gainers') {
      // 빗썸 "급등" 공식 엔드포인트가 없어서 예시/대체 로직 (필요시 교체)
      // 실서비스에서는 내부 집계나 24h 변동률 상위 정렬로 치환
      const list = [
        { symbol: 'MIX', chg: 50.11 },
        { symbol: 'CAMP', chg: 14.24 },
        { symbol: 'SOFI', chg: 10.65 },
        { symbol: 'SOON', chg: 8.48 },
        { symbol: 'SLF', chg: 7.97 },
        { symbol: 'KERNEL', chg: 7.72 },
        { symbol: 'QTUM', chg: 6.85 },
        { symbol: 'LISTA', chg: 5.89 }
      ];
      return res.status(200).json({ items: list, ts: Date.now() });
    }

    return res.status(400).json({ error: 'Unknown path' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
