// /api/markets.js — 업비트 코인 목록(한글명 포함) 프록시
export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=false", {
      headers: { "Accept": "application/json" },
      // cf. Vercel Edge에서 node-fetch 필요 없이 fetch 사용 가능
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: "upbit_upstream_failed", text: t });
    }

    const data = await r.json(); // [{ market:"KRW-BTC", korean_name:"비트코인", ...}, ...]
    const krw = data.filter(m => m.market && m.market.startsWith("KRW-"));

    // CDN 캐시 (브라우저 캐시는 안 함)
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json(krw);
  } catch (e) {
    return res.status(500).json({ error: "markets_proxy_failed", detail: String(e) });
  }
}
