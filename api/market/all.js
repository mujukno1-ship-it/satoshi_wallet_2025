export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.upbit.com/v1/market/all?isDetails=false");
    const data = await r.json();
    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
