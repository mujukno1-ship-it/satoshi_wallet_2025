export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=false", {
      headers: { Accept: "application/json" },
      // keepalive 같은 추가 옵션 불필요
    });
    if (!r.ok) return res.status(r.status).json({ error: "upbit "+r.status });
    const data = await r.json();

    // CDN 캐시로 성능/안정 ↑
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

