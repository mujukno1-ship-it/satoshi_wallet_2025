// /api/upbit.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...(opts.headers || {}) },
        cache: "no-store",
        ...opts,
      });
      if (res.status === 429) {
        // 업비트 레이트 리밋: 점점 길게 쉰 뒤 재시도
        await sleep(400 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(300 * (i + 1));
    }
  }
  throw lastErr;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, max-age=0, s-maxage=0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // 1) 마켓 목록
    const markets = await fetchJson(
      "https://api.upbit.com/v1/market/all?isDetails=false"
    );

    // KRW-마켓만, 너무 많으면 제한 (레이트리밋 회피)
    const krw = markets.filter((m) => m.market?.startsWith("KRW-")).slice(0, 80);
    const nameMap = new Map(krw.map((m) => [m.market, m.korean_name || m.market]));

    // 2) 티커를 1회에 30개씩 끊어서 요청 (429 방지)
    const chunks = [];
    for (let i = 0; i < krw.length; i += 30) chunks.push(krw.slice(i, i + 30));

    const tickerAll = [];
    for (const group of chunks) {
      const param = group.map((m) => m.market).join(",");
      const data = await fetchJson(
        `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(param)}`
      );
      tickerAll.push(...data);
      // 그룹 사이 잠깐 휴식 (레이트리밋 회피)
      await sleep(250);
    }

    const items = tickerAll
      .map((t) => ({
        symbol: String(t.market || "").replace("KRW-", ""),
        name: nameMap.get(t.market) || String(t.market || "").replace("KRW-", ""),
        price: Number(t.trade_price || 0),
        ratePercent: Number(t.signed_change_rate || 0) * 100, // 등락률(%)
      }))
      .filter((x) => Number.isFinite(x.price))
      .sort((a, b) => (b.ratePercent || 0) - (a.ratePercent || 0))
      .slice(0, 12);

    return res.status(200).json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, items: [], error: String(e) });
  }
}
