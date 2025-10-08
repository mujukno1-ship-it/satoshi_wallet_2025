// /api/markets.js — 업비트 코인 목록 (KRW-마켓만, 한글명 포함)
export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=false");
    if (!r.ok) throw new Error("Upbit response failed");
    const data = await r.json();

    // KRW-마켓만 필터링
    const krw = data.filter(m => m.market && m.market.startsWith("KRW-"));

    // 캐시 5분 유지
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json(krw);
  } catch (e) {
    return res.status(500).json({
      error: "markets_proxy_failed",
      detail: String(e),
    });
  }
}
