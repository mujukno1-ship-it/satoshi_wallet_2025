// api/upbit/ticker.js
module.exports = async (req, res) => {
  const { markets } = req.query; // 예: KRW-BTC 또는 KRW-BTC,KRW-ETH
  if (!markets) {
    return res
      .status(400)
      .json({ ok: false, error: 'Query "markets" is required. e.g. KRW-BTC' });
  }

  try {
    const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(
      markets
    )}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`UPBIT ${r.status}`);
    const data = await r.json();

    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
