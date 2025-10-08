// /api/tickers.js — 업비트 시세 데이터 프록시
export default async function handler(req, res) {
  try {
    const q = String(req.query.markets || "").trim();
    if (!q) return res.status(400).json({ error: "missing_markets_param" });

    const arr = q.split(",").map(s => s.trim()).filter(Boolean);
    const chunks = Array.from({ length: Math.ceil(arr.length / 30) }, (_, i) =>
      arr.slice(i * 30, (i + 1) * 30)
    );

    let out = [];
    for (const part of chunks) {
      const url = "https://api.upbit.com/v1/ticker?markets=" +
                  encodeURIComponent(part.join(","));
      const r = await fetch(url);
      if (!r.ok) continue;
      out = out.concat(await r.json());
      await new Promise(r => setTimeout(r, 50)); // 호출 속도 완화
    }

    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=30");
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "tickers_failed", detail: String(e) });
  }
}
