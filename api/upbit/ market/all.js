export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=false",
      { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(r.status).json({ ok:false, from:"upbit" });
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ ok:true, data });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
