export const config = { runtime: "edge" };
// 빗썸 급등 리스트 & 검색. 빗썸 공용 API 사용.
// ?top=1&limit=8   | ?q=리플/ETH/XRP 등

const MAP_KR = {
  "BTC":"비트코인","ETH":"이더리움","XRP":"리플","ADA":"에이다","DOGE":"도지코인","SOL":"솔라나",
  "BCH":"비트코인캐시","AVAX":"아발란체","APT":"앱토스","ARB":"아비트럼","SUI":"수이","OP":"옵티미즘",
  "TON":"톤코인","WLD":"월드코인","LINK":"체인링크","MATIC":"폴리곤","DOT":"폴카닷","ATOM":"코스모스",
  "PEPE":"페페","SHIB":"시바이누","STX":"스택스","RPL":"로켓풀","BLUR":"블러","SEI":"세이"
};

function riskFromPct(p) {
  const ap = Math.abs(p);
  if (ap < 3) return "낮음";
  if (ap < 7) return "중간";
  return "높음";
}

async function getJson(url){ const r=await fetch(url); if(!r.ok) throw new Error(r.status); return r.json(); }

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const wantTop = searchParams.get("top");
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 8)));
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    // ALL tickers(KRW만)
    const all = await getJson("https://api.bithumb.com/public/ticker/ALL_KRW");
    if (all.status !== "0000") throw new Error("bithumb error");

    const items = Object.entries(all.data)
      .filter(([sym]) => sym !== "date")
      .map(([sym, v]) => {
        const price = Number(v.closing_price);
        const open = Number(v.opening_price || v.prev_closing_price || price);
        const high = Number(v.max_price || price);
        const low  = Number(v.min_price || price);
        const changePct = open ? ((price - open) / open) * 100 : 0;
        const stopLoss = Math.round(low * 0.98);
        return {
          exchange: "빗썸",
          symbol: `KRW-${sym}`,
          name: MAP_KR[sym] || sym,
          price,
          changePct: Number(changePct.toFixed(2)),
          high, low,
          bid1: Number(v.bid_price || 0) || null,
          ask1: Number(v.ask_price || 0) || null,
          risk: riskFromPct(changePct),
          stopLoss
        };
      });

    let out = items;

    if (wantTop) {
      out = [...items].sort((a,b)=> b.changePct - a.changePct).slice(0, limit);
    } else if (q) {
      out = items.filter(x => {
        const k = (x.name || "").toLowerCase();
        const s = (x.symbol || "").toLowerCase();
        return k.includes(q) || s.includes(q);
      }).slice(0, 30);
    }

    return new Response(JSON.stringify({ exchange: "빗썸", items: out }), {
      headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  }
}
