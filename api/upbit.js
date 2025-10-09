/api/upbit.js
/integrations/upbit/public.js
// /api/upbit.js
export default async function handler(req, res) {
  try {
    const { type, markets } = req.query;
    const BASE = "https://api.upbit.com/v1";

    let url;
    if (type === "ticker" && markets) {
      url = `${BASE}/ticker?markets=${encodeURIComponent(markets)}`;
    } else if (type === "markets" || type === "market") {
      url = `${BASE}/market/all?isDetails=false`;
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await response.json();

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Upbit fetch failed" });
  }
}

