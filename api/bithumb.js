// api/bithumb.js
// 비트썸 공개 API에서 KRW 마켓 전체 티커를 받아 간단 스키마로 변환
// 실패해도 절대 500을 내지 않고 { ok:false, error } 로 200 반환

export default async function handler(req, res) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 7000); // 7초 타임아웃

    const url = "https://api.bithumb.com/public/ticker/ALL_KRW";
    const r = await fetch(url, {
      method: "GET",
      // 일부 환경에서 User-Agent 없으면 차단되는 경우가 있어 헤더 추가
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SatoshiWallet/9.3)" },
      signal: controller.signal,
      // Vercel Edge가 아니면 필요 없음. (기본 Node 런타임 fetch)
    });
    clearTimeout(t);

    if (!r.ok) {
      // 비트썸이 429/5xx 주는 경우
      return res.status(200).json({ ok: false, error: `HTTP ${r.status}` });
    }

    const data = await r.json();

    if (data.status !== "0000" || !data.data) {
      return res.status(200).json({ ok: false, error: `Bithumb status ${data.status}` });
    }

    // data.data 안에 각 코인 심볼 키가 있고 값은 티커 객체, 'date' 키는 제외
    const items = Object.entries(data.data)
      .filter(([symbol]) => symbol !== "date")
      .map(([symbol, v]) => {
        // 값이 이상한 경우 방어
        const safe = v || {};
        const price = Number(safe.closing_price ?? NaN);
        const high = Number(safe.max_price ?? NaN);
        const low = Number(safe.min_price ?? NaN);
        const bid1 = Number(safe.buy_price ?? NaN);
        const ask1 = Number(safe.sell_price ?? NaN);
        const changePct = Number(safe.fluctate_rate_24H ?? NaN); // 24h %

        return {
          exchange: "빗썸",
          symbol: `KRW-${symbol}`,
          name: symbol, // 필요하면 별칭 매핑 가능
          price,
          high,
          low,
          bid1,
          ask1,
          changePct,
        };
      });

    return res.status(200).json({ ok: true, exchange: "빗썸", items });
  } catch (e) {
    // 절대 500 내지 말고, 화면이 에러페이지로 안 가게 200으로 돌려준다
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
