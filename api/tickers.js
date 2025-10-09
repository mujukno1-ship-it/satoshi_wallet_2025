// api/tickers.js — 업비트 API 안전 버전 (기존기능 유지 + 오류수정)
export default async function handler(req, res) {
  try {
    const UPBIT_API = "https://api.upbit.com/v1";
    const fetchJSON = async (url) => {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };

    // 1️⃣ 마켓 전체 가져오기
    const markets = await fetchJSON(`${UPBIT_API}/market/all?isDetails=true`);
    const krwMarkets = markets
      .filter((m) => m.market.startsWith("KRW-"))
      .map((m) => ({
        market: m.market,
        korean_name: m.korean_name,
        english_name: m.english_name,
      }));

    // 2️⃣ 가격 정보 가져오기
    const tickersResp = await fetchJSON(
      `${UPBIT_API}/ticker?markets=${krwMarkets
        .map((m) => m.market)
        .slice(0, 100)
        .join(",")}`
    );

    // 3️⃣ 데이터 정리
    const rows = tickersResp.map((t) => {
      const market = krwMarkets.find((m) => m.market === t.market);
      const nameKr = market ? market.korean_name : t.market;
      const now = t.trade_price;
      const change = (t.signed_change_rate * 100).toFixed(2);
      const warmState =
        change >= 5 ? "급등🚀" : change >= 2 ? "예열🔥" : change <= -3 ? "하락⚠️" : "중립";

      return {
        symbol: t.market,
        nameKr,
        now,
        warmState,
        targets: {
          long: { B1: Math.round(now * 0.985), TP1: Math.round(now * 1.015) },
        },
        change,
      };
    });

    // 4️⃣ 급등/급락 정렬
    const spikes = {
      up: rows.filter((r) => r.change >= 5).slice(0, 8),
      down: rows.filter((r) => r.change <= -3).slice(0, 8),
    };

    // 5️⃣ 결과 리턴
    res.status(200).json({ ok: true, rows, spikes });
  } catch (err) {
    console.error("⚠️ API 오류:", err.message);
    res
      .status(200)
      .json({ ok: false, error: err.message, rows: [], spikes: { up: [], down: [] } });
  }
}
