export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.bithumb.com/public/ticker/ALL_KRW");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const items = Object.entries(data.data)
      .filter(([symbol]) => !symbol.includes("date"))
      .slice(0, 10)
      .map(([symbol, info]) => ({
        symbol,
        price: parseFloat(info.closing_price),
      }));

    res.status(200).json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
