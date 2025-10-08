// /api/tickers.js — 사토시의지갑 완전통합버전
// ✅ 기존기능유지 + 검색기능추가 + 급등·급락 한세트 + 오류수정

import { marketsKRW, getTickerFast, getCandles1mFast } from "../lib/upbit_private.js";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // 🔹 1. 전체 마켓 가져오기
    const markets = await marketsKRW();
    const codes = markets.map(m => m.market);
    const names = Object.fromEntries(markets.map(m => [m.market, m.korean_name]));

    // 🔹 2. 현재가 불러오기
    const tickerMap = await getTickerFast(codes);
    const tickers = Object.values(tickerMap);

    // 🔹 3. 최근 1분 봉 가져오기 (급등/급락 탐지용)
    const candles = await getCandles1mFast(codes);
    const candleMap = Object.fromEntries(candles.map(c => [c.market, c]));

    // 🔹 4. 검색 필터 (코인명 or 심볼 포함 시)
    const filtered = q
      ? tickers.filter(t => {
          const name = names[t.market]?.toLowerCase() || "";
          const symbol = t.market.replace("KRW-", "").toLowerCase();
          return name.includes(q) || symbol.includes(q);
        })
      : tickers;

    // 🔹 5. 데이터 매핑
    const rows = filtered.map(t => {
      const nameKr = names[t.market] || t.market;
      const candle = candleMap[t.market];
      const prev = candle?.prev_closing_price || t.prev_closing_price || 0;
      const change = ((t.trade_price - prev) / prev) * 100;
      const warmState =
        change > 3 ? "🔥 예열" :
        change < -3 ? "❄️ 냉각" : "🌗 중립";

      return {
        symbol: t.market,
        nameKr,
        now: t.trade_price,
        change: Number(change.toFixed(2)),
        warmState,
        targets: {
          long: {
            B1: Math.floor(t.trade_price * 0.985), // 매수1
            TP1: Math.floor(t.trade_price * 1.015), // 매도1
          },
        },
      };
    });

    // 🔹 6. 급등·급락 감지 (1분 변동률 기반)
    const spikesUp = rows
      .filter(r => r.change >= 5)
      .sort((a, b) => b.change - a.change)
      .slice(0, 5);
    const spikesDown = rows
      .filter(r => r.change <= -5)
      .sort((a, b) => a.change - b.change)
      .slice(0, 5);

    const spikes = { up: spikesUp, down: spikesDown };

    // 🔹 7. 응답
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        updatedAt: new Date().toISOString(),
        tickers: tickerMap,
        rows,
        spikes,
      })
    );
  } catch (err) {
    console.error("⚠️ tickers.js 오류:", err);
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: false,
        error: err.message || "알 수 없는 오류",
      })
    );
  }
}
