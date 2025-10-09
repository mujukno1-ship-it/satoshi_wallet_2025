// ✅ 업비트/빗썸 통합 티커 핸들러 (안정형)
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const qNorm = normalize(url.searchParams.get("q") || "");

    // 시장 목록 가져오기
    const markets = await getKRWMarkets();
    const pool = qNorm ? markets.filter(m => matchesQuery(m, qNorm)) : markets;
    const codes = pool.map(m => m.market);

    // 시세 + 호가 병렬 요청 (10초 타임아웃 포함)
    const [tickersArr, obMap] = await Promise.all([
      getTickers(codes),
      getOrderbooks(codes),
    ]);

    // 데이터 정리
    const rows = tickersArr.map(u => {
      const m = pool.find(x => x.market === u.market) || {};
      const ob = obMap[u.market] || {};
      const now = Number(u.trade_price) || 0;
      const bid = Number(ob.bid_price ?? ob.bid ?? now);
      const ask = Number(ob.ask_price ?? ob.ask ?? now);

      const B1 = now * 0.995;
      const TP1 = now * 1.015;
      const SL = now * 0.98;

      const risk = Math.floor(Math.random() * 3) + 1;
      const warmState = "중립";

      return {
        symbol: m.market,
        nameKr: m.korean_name,
        now,
        order: { bid, ask }, // ✅ 원본 호가
        targets: { long: { B1, TP1, SL } },
        change: u.signed_change_rate,
        warmState,
        risk,
        comment: "-",
        startTime: null,
        endTime: null,
        badges: [],
      };
    });

    // 응답 (성공)
    return res.status(200).json({
      ok: true,
      rows,
      tickers: rows,
      spikes: {},
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error("[/api/tickers] error:", e);

    // ✅ 에러여도 JSON으로 반환 → 프론트 무한로딩 방지
    return res.status(200).json({
      ok: false,
      error: e.message || String(e),
      rows: [],
      tickers: [],
      spikes: {},
      updatedAt: Date.now(),
    });
  }
}
