// api/bithumb.js
// 빗썸 상승률 TOP10 (KRW) — 한글명 매핑 + 퍼센트 필드 호환(rate & ratePercent 모두 제공)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  try {
    const resp = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { next: { revalidate: 10 } });
    if (!resp.ok) throw new Error(`Bithumb HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json || json.status !== '0000' || !json.data) throw new Error('Bithumb API format unexpected');

    const raw = json.data;

    // 한글 심볼 매핑 (없어도 동작)
    let symbolsMap = {};
    try {
      const prod = await fetch('https://satoshi-wallet-2025.vercel.app/symbols_ko.json').catch(() => null);
      if (prod?.ok) symbolsMap = await prod.json();
      else {
        const local = await fetch('/symbols_ko.json').catch(() => null);
        if (local?.ok) symbolsMap = await local.json();
      }
    } catch (_) {}

    const list = [];
    for (const key of Object.keys(raw)) {
      if (key === 'date') continue;
      const it = raw[key];
      if (!it || typeof it !== 'object') continue;

      const rate = Number(it.fluctate_rate_24H);
      const price = Number(it.closing_price);
      if (!isFinite(rate) || !isFinite(price)) continue;

      const symbol = key.toUpperCase();
      const nameKo =
        symbolsMap[symbol] ||
        symbolsMap[`KRW-${symbol}`] ||
        symbolsMap[`KRW_${symbol}`] ||
        symbol;

      list.push({
        symbol,            // MIX
        name: nameKo,      // 믹스 (없으면 MIX)
        market: 'BITHUMB',
        price,             // 현재가(원)
        rate,              // 숫자 %
        ratePercent: rate, // 화면 호환 용 키
        updatedAt: Date.now()
      });
    }

    list.sort((a, b) => b.rate - a.rate);
    const top10 = list.slice(0, 10);

    return res.status(200).json({ ok: true, count: top10.length, items: top10 });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e), items: [] });
  }
}
