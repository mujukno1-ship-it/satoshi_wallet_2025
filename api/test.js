// api/test.js
export default async function handler(req, res) {
  const baseUrl =
    process.env.API_BASE_URL || "https://satoshijibag-api.onrender.com";

  try {
    const r = await fetch(`${baseUrl}/health`);
    const data = await r.json();
    res.status(200).json({
      frontend: "Satoshi Wallet Front",
      backend: data,
      ok: true,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: String(err),
      backend: baseUrl,
    });
  }
}
