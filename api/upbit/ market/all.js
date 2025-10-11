export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.upbit.com/v1/market/all?isDetails=false");
    const data = await response.json();
    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
