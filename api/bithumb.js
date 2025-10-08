// api/bithumb.js
// 빗썸 상승률 TOP10 (KRW) — 한글명 매핑 + 퍼센트 필드 호환(rate & ratePercent 모두 제공)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  try {
    // 1) 빗썸 전체 KRW 티커
    const resp = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { next: { revalidate: 10 } });
    if (!resp.ok) throw new Error(`Bithumb HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json || json.status !== '0000' || !json.data) throw new Error('Bithumb API format unexpected');

    const raw = json.data;

    // 2) 한글 심볼 매핑 (public/symbols_ko.json)
    let symbolsMap = {};
    try {
      // 배포/로컬 모두 커버
      const mapResp =
        await fetch('https://satoshi-wallet-2025.vercel.app/symbols_ko.json').catch(() => null) ||
        await fetch('/symbols_ko.json').catch(() => null);
      if (mapResp && mapResp.ok) symbolsMap = await mapResp.json();
    } catch (_) {
      symbolsMap = {};
    }

    // 3) 가공
    const list = [];
    for (const key of Object.keys(raw)) {
      if (key === 'date') continue;
      const it = raw[key];
      if (!it || typeof it !== 'object') continue;

      // 빗썸 제공 값: 등락률(24H) = fluctu​ate_rate_24H (문자열)
      const rate = Number(it.fluctate_rate_24H);   // 예: 12.34
      const price = Number(it.closing_price);      // 현재가
      if (!isFinite(rate) || !isFinite(price)) continue;

      const symbol = key.toUpperCase();            // MIX, API3 ...
      const nameKo = symbolsMap[symbol] || symbolsMap[`KRW-${symbol}`] || symbolsMap[`KRW_${symbol}`] || symbol;

      list.push({
        symbol,                    // 'MIX'
        name: nameKo,              // '믹스' (없으면 'MIX')
        market: 'BITHUMB',
        price,                     // 숫자(원)
        rate,                      // 숫자(%)  -> 화면 호환 위해 남김
        ratePercent: rate,         // 숫자(%)  -> 화면이 이 키를 읽어도 됨
        updatedAt: Date.now()
      });
    }

    // 4) 상위 10개 (내림차순)
    list.sort((a, b) => b.rate - a.rate);
    const top10 = list.slice(0, 10);

    return res.status(200).json({ ok: true, count: top10.length, items: top10 });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e), items: [] });
  }
}
