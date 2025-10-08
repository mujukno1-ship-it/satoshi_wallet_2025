// api/bithumb.js (CommonJS 버전)
// - 절대 500을 내지 않도록 방어 (에러여도 200으로 JSON 반환)
// - Node 18 서버리스에서 global fetch 사용

module.exports = async (req, res) => {
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 7000); // 7초 타임아웃

    const url = "https://api.bithumb.com/public/ticker/ALL_KRW";
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SatoshiWallet/9.3)",
        "Accept": "application/json"
      },
      signal: controller.signal,
    });
    clearTimeout(to);

    if (!r.ok) {
      return res.status(200).json({ ok: false, error: `HTTP ${r.status}` });
    }

    const data = await r.json();
    if (data.status !== "0000" || !data.data) {
      return res.status(200).json({ ok: false, error: `Bithumb status ${data.status}` });
    }

    const items = Object.entries(data.data)
      .filter(([symbol]) => symbol !== "date")
      .map(([symbol, v]) => {
        const safe = v || {};
        return {
          exchange: "빗썸",
          symbol: `KRW-${symbol}`,
          name: symbol,
          price: Number(safe.closing_price ?? NaN),
          high: Number(safe.max_price ?? NaN),
          low: Number(safe.min_price ?? NaN),
          bid1: Number(safe.buy_price ?? NaN),
          ask1: Number(safe.sell_price ?? NaN),
          changePct: Number(safe.fluctate_rate_24H ?? NaN),
        };
      });

    return res.status(200).json({ ok: true, exchange: "빗썸", items });
  } catch (e) {
    // 500 대신 200으로 에러 메시지 전달 → Vercel 500 페이지 방지
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
