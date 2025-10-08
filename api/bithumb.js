// api/bithumb.js
// 빗썸 상승률 TOP10 (KRW) — 한글명 매핑 + 퍼센트 필드(rate & ratePercent) 동시 제공

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  try {
    const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { next: { revalidate: 10 } });
    if (!r.ok) throw new Error(`Bithumb HTTP ${r.status}`);
    const j = await r.json();
    if (!j || j.status !== '0000' || !j.data) throw new Error('Bithumb API format unexpected');
    const raw = j.data;

    // 한글 매핑
    let map = {};
    try {
      const a = await fetch('https://satoshi-wallet-2025.vercel.app/symbols_ko.json').catch(() => null);
      if (a?.ok) map = await a.json();
      else {
        const b = await fetch('/symbols_ko.json').catch(() => null);
        if (b?.ok) map = await b.json();
      }
    } catch (_) {}

    const arr = [];
    for (const k of Object.keys(raw)) {
      if (k === 'date') continue;
      const it = raw[k];
      if (!it || typeof it !== 'object') continue;
      const rate = Number(it.fluctate_rate_24H);
      const price = Number(it.closing_price);
      if (!isFinite(rate) || !isFinite(price)) continue;

      const sym = k.toUpperCase();
      const name = map[sym] || map[`KRW-${sym}`] || map[`KRW_${sym}`] || sym;

      arr.push({
        symbol: sym,
        name,
        market: 'BITHUMB',
        price,
        rate,
        ratePercent: rate,
        updatedAt: Date.now()
      });
    }
    arr.sort((a, b) => b.rate - a.rate);
    return res.status(200).json({ ok: true, count: Math.min(10, arr.length), items: arr.slice(0, 10) });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e), items: [] });
  }
}
