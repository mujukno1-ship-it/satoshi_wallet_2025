// api/upbit/market/all.js
module.exports = async (req, res) => {
  try {
    const r = await fetch(
      'https://api.upbit.com/v1/market/all?isDetails=false',
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) throw new Error(`UPBIT ${r.status}`);
    const data = await r.json();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    res.status(200).json({ ok: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
