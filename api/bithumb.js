// api/bithumb.js
// 안정 버전 — 500 안 나고 JSON으로 항상 응답
module.exports = async (req, res) => {
  try {
    const url = "https://api.bithumb.com/public/ticker/ALL_KRW";
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SatoshiWallet/9.3)"
      },
    });

    if (!response.ok) {
      return res.status(200).json({
        ok: false,
        error: `HTTP ${response.status}`,
      });
    }

    const data = await response.json();
    if (data.status !== "0000" || !data.data) {
      return res.status(200).json({
        ok: false,
        error: `Invalid data from Bithumb`,
      });
    }

    // 변환
    const items = Object.entries(data.data)
      .filter(([key]) => key !== "date")
      .map(([key, v]) => ({
        exchange: "빗썸",
        symbol: `KRW-${key}`,
        name: key,
        price: Number(v.closing_price || 0),
        high: Number(v.max_price || 0),
        low: Number(v.min_price || 0),
        bid1: Number(v.buy_price || 0),
        ask1: Number(v.sell_price || 0),
        changePct: Number(v.fluctate_rate_24H || 0),
      }));

    return res.status(200).json({
      ok: true,
      exchange: "빗썸",
      items,
    });
  } catch (e) {
    // 에러여도 절대 500을 내지 않게 한다
    return res.status(200).json({
      ok: false,
      error: e.message || String(e),
    });
  }
};
