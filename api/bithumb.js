// /api/bithumb.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJsonWithUA(url, tries = 3, timeoutMs = 7000) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "accept": "application/json",
          // 일부 서버는 UA 없으면 500/차단하는 경우가 있어 안전하게 명시
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      clearTimeout(t);
      await sleep(300 * (i + 1));
    }
  }
  throw lastErr;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, max-age=0, s-maxage=0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const j = await fetchJsonWithUA(
      "https://api.bithumb.com/public/ticker/ALL_KRW"
    );

    const raw = j?.data || {};
    const items = Object.entries(raw)
      .filter(([k, v]) => k !== "date" && v && (v.closing_price || v.closing_price === 0))
      .map(([symbol, v]) => {
        const price = Number(v.closing_price);
        // API에 따라 24H 등락률 키가 다를 수 있어 모두 대비
        const rate =
          v.fluctate_rate_24H !== undefined
            ? Number(v.fluctate_rate_24H)
            : v.fluctate_rate !== undefined
            ? Number(v.fluctate_rate)
            : 0;

        return {
          symbol,
          name: symbol,
          price: Number.isFinite(price) ? price : null,
          ratePercent: Number.isFinite(rate) ? rate : null,
        };
      })
      .filter((x) => x.price !== null && x.ratePercent !== null)
      .sort((a, b) => (b.ratePercent || 0) - (a.ratePercent || 0))
      .slice(0, 12);

    return res.status(200).json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, items: [], error: String(e) });
  }
}
