// api/bithumb.js
// 빗썸 실시간 급등 Top10 (KRW 마켓) + 한글명 매핑
// UI는 /api/bithumb 를 주기적으로 호출해 리스트를 뿌립니다.

export default async function handler(req, res) {
  // CORS & 캐시
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  try {
    // 1) 빗썸 전체 티커 (KRW)
    const url = 'https://api.bithumb.com/public/ticker/ALL_KRW';
    const resp = await fetch(url, { next: { revalidate: 10 } });
    if (!resp.ok) throw new Error(`Bithumb HTTP ${resp.status}`);

    const json = await resp.json();
    if (!json || json.status !== '0000' || !json.data) {
      throw new Error('Bithumb API format unexpected');
    }

    const data = json.data;

    // 2) 한글 심볼 매핑 파일 불러오기 (public/symbols_ko.json)
    //    존재하지 않는 경우도 안전하게 처리
    let symbolsMap = {};
    try {
      const mapResp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/symbols_ko.json`)
        .catch(() => fetch('https://satoshi-wallet-2025.vercel.app/symbols_ko.json')); // 로컬/프로덕션 모두 커버
      if (mapResp && mapResp.ok) {
        symbolsMap = await mapResp.json();
      }
    } catch (e) {
      // 매핑 실패해도 기능은 동작 (영문만 표기)
      symbolsMap = {};
    }

    // 3) KRW 마켓만 추출하여 등락률 기준 정렬
    const items = [];
    for (const key of Object.keys(data)) {
      if (key === 'date') continue; // 메타키 제외
      const item = data[key];
      if (!item || typeof item !== 'object') continue;

      // 24시간 등락률(%) & 현재가
      const rate = Number(item.fluctate_rate_24H);
      const price = Number(item.closing_price);

      if (!isFinite(rate) || !isFinite(price)) continue;

      // 심볼 표준화 (BTC, ETH 등)
      const symbol = key.toUpperCase();
      const nameKo = symbolsMap[symbol] || symbolsMap[`KRW-${symbol}`] || symbolsMap[`KRW_${symbol}`] || symbol;

      items.push({
        symbol,                  // 예: BTC
        name: nameKo,            // 예: 비트코인
        rate,                    // +12.34 (양수/음수)
        price,                   // 현재가(원)
        market: 'BITHUMB',
        ts: Date.now()
      });
    }

    // 4) 등락률 내림차순 상위 10개
    items.sort((a, b) => b.rate - a.rate);
    const top = items.slice(0, 10);

    return res.status(200).json({ ok: true, count: top.length, items: top });
  } catch (err) {
    // 실패 시에도 UI가 깨지지 않도록 안전 반환
    return res.status(200).json({ ok: false, error: String(err), items: [] });
  }
}
