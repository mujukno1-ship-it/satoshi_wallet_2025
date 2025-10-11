// /api/ticker (Edge/Node 공통 아이디어)
export default async function handler(req, res) {
  try {
    const raw = (req.query.markets || '').toString().toUpperCase().trim();

    // 공백 제거, 중복 제거
    const list = Array.from(new Set(
      raw.split(',').map(s => s.trim()).filter(Boolean)
    ));

    // 서버에서도 마지막 방어막 (유효성 검사)
    const valid = list.filter(m => /^(KRW|BTC|USDT)-[A-Z0-9]+$/.test(m));
    if (valid.length === 0) {
      return res.status(400).json({ error: 'no valid markets' });
    }

    const qs = new URLSearchParams({ markets: valid.join(',') }).toString();
    const upbitURL = `https://api.upbit.com/v1/ticker?${qs}`;

    const r = await fetch(upbitURL, { headers: { 'Accept': 'application/json' }});
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'upbit error', body: text });
    }
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
