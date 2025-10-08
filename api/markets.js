// /api/markets.js — 업비트 KRW 코인 목록 프록시
export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=false");
    const data = await r.json();
    const krw = data.filter(m => m.market.startsWith("KRW-"));
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(krw);
  } catch (e) {
    res.status(500).json({ error: "markets_failed", detail: String(e) });
  }
}
