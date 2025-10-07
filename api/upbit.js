export const config = { runtime: "edge" };
// Upbit public API를 사용해 급등 리스트 & 검색/시세/호가 제공
// ?top=1&limit=8  : 급등 상위 N
// ?q=검색어       : 코인명(한글/영문)/심볼/시장 문자열 검색
// 결과는 공통 구조: {exchange, items:[{symbol, name, price, changePct, bid1, ask1, high, low, risk, stopLoss}]}

const UPBIT = "https://api.upbit.com/v1";

async function getJson(url) {
  const r = await fetch(url, { headers: { "accept": "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function chunk(arr, n = 100) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function riskFromPct(p) {
  const ap = Math.abs(p);
  if (ap < 3) return "낮음";
  if (ap < 7) return "중간";
  return "높음";
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const wantTop = searchParams.get("top");
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 8)));
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    // 1) 마켓 목록(한글명 포함)
    const marketsAll = await getJson(`${UPBIT}/market/all?isDetails=true`);
    const krw = marketsAll.filter(m => m.market.startsWith("KRW-"));

    // 2) KRW 마켓 티커 정보
    const markets = krw.map(m => m.market);
    const ticks = [];
    for (const c of chunk(markets, 100)) {
      const arr = await getJson(`${UPBIT}/ticker?markets=${c.join(",")}`);
      ticks.push(...arr);
    }

    // 3) orderbook(상위 호가 1) - 검색 응답 품질 향상용
    const orderbookMap = new Map();
    for (const c of chunk(markets, 30)) {
      const obs = await getJson(`${UPBIT}/orderbook?markets=${c.join(",")}`);
      for (const ob of obs) {
        const a = ob.orderbook_units?.[0];
        orderbookMap.set(ob.market, { bid1: a?.bid_price ?? null, ask1: a?.ask_price ?? null });
      }
    }

    // KRW 마켓 맵
    const nameMap = new Map(krw.map(m => [m.market, m.korean_name]));
    // 항목 변환
    const items = ticks.map(t => {
      const changePct = (t.signed_change_rate || 0) * 100;
      const ob = orderbookMap.get(t.market) || {};
      const stopLoss = t.low_price ? Math.round(t.low_price * 0.98) : null;
      return {
        exchange: "업비트",
        symbol: t.market,                   // 예: KRW-BTC
        name: nameMap.get(t.market) || t.market.replace("KRW-", ""),
        price: t.trade_price,
        changePct: Number(changePct.toFixed(2)),
        high: t.high_price,
        low: t.low_price,
        bid1: ob.bid1 ?? null,
        ask1: ob.ask1 ?? null,
        risk: riskFromPct(changePct),
        stopLoss
      };
    });

    let out = items;

    if (wantTop) {
      out = [...items].sort((a, b) => b.changePct - a.changePct).slice(0, limit);
    } else if (q) {
      out = items.filter(x => {
        const k = (x.name || "").toLowerCase();
        const s = (x.symbol || "").toLowerCase();
        return k.includes(q) || s.includes(q) || k.replace(/\s+/g, "").includes(q.replace(/\s+/g,""));
      }).slice(0, 30);
    }

    return new Response(JSON.stringify({ exchange: "업비트", items: out }), {
      headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  }
}
