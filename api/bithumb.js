export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, max-age=0, s-maxage=0',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', { cache: 'no-store' });
    const j = await r.json();
    if (j?.status !== '0000' || !j?.data) {
      return new Response(JSON.stringify({ ok:false, items:[] }), { headers });
    }

    const items = Object.entries(j.data)
      .filter(([k,v]) => k !== 'date' && v && v.closing_price)
      .map(([symbol, v]) => ({
        symbol,
        name: symbol,
        price: Number(v.closing_price),
        ratePercent: Number(v.fluctate_rate_24H)
      }))
      .sort((a,b) => b.ratePercent - a.ratePercent)
      .slice(0, 12);

    return new Response(JSON.stringify({ ok: true, items }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, items:[], error:String(e) }), { headers });
  }
}
