export default async function handler(req, res) {
  const { markets } = req.query;
  if (!markets) return res.status(400).json({ ok: false, error: "markets required" });

  try {
    const r = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`);
    const data = await r.json();
    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
