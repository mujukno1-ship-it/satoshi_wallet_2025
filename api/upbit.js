export const config = { runtime: "edge" };

// ──────────────────────────────
// 공통 유틸: 검색 정규화 + 별칭/별명 매칭
// ──────────────────────────────
function norm(s = "") {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")     // 공백 제거
    .replace(/-/g, "")       // 하이픈 제거 (krw-btc → krwbtc)
    .replace(/_/g, "")
    .replace(/코인/g, "")    // '코인' 접미어 제거
    .replace(/캐쉬/g, "캐시"); // 캐쉬/캐시 통일
}

// 자주 쓰는 별칭(필요시 추가 가능)
const ALIAS = {
  BTC: ["비트", "비트코인", "빗코", "비코", "bitcoin", "btc"],
  BCH: ["비트코인캐시", "비트코인캐쉬", "비캐", "bitcoin cash", "bitcoincash", "bch"],
  ETH: ["이더", "이더리움", "eth", "ethereum"],
  XRP: ["리플", "xrp"],
  ADA: ["에이다", "cardano", "ada"],
  DOGE: ["도지", "도지코인", "doge"],
  SOL: ["솔", "솔라나", "sol"]
};

function aliasTokens(symbol, name) {
  const sym = (symbol || "").replace(/^KRW-/, "");
  const toks = [name || "", symbol || "", sym];
  if (ALIAS[sym]) toks.push(...ALIAS[sym]);
  return toks.map(norm);
}

function scoreItem(qNorm, tokens) {
  // 정확/시작/포함 순으로 가중치 부여
  let sc = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (t === qNorm) sc += 100;      // 완전일치
    else if (t.startsWith(qNorm)) sc += 50; // 시작일치
    else if (t.includes(qNorm)) sc += 10;   // 부분일치
  }
  return sc;
}

function riskFromPct(p) {
  const ap = Math.abs(p);
  if (ap < 3) return "낮음";
  if (ap < 7) return "중간";
  return "높음";
}

// ──────────────────────────────
// 실제 API 처리
// ──────────────────────────────
const UPBIT = "https://api.upbit.com/v1";
async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function chunk(arr, n = 100) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const wantTop = searchParams.get("top");
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 8)));
    const qRaw = (searchParams.get("q") || "").trim();
    const qNorm = norm(qRaw);

    // 1) 마켓/한글명
    const marketsAll = await getJson(`${UPBIT}/market/all?isDetails=true`);
    const krw = marketsAll.filter((m) => m.market.startsWith("KRW-"));
    const nameMap = new Map(krw.map((m) => [m.market, m.korean_name]));

    // 2) 티커
    const markets = krw.map((m) => m.market);
    const ticks = [];
    for (const c of chunk(markets, 100)) {
      ticks.push(...(await getJson(`${UPBIT}/ticker?markets=${c.join(",")}`)));
    }

    // 3) 호가(상위1)
    const orderbookMap = new Map();
    for (const c of chunk(markets, 30)) {
      const obs = await getJson(`${UPBIT}/orderbook?markets=${c.join(",")}`);
      for (const ob of obs) {
        const a = ob.orderbook_units?.[0];
        orderbookMap.set(ob.market, { bid1: a?.bid_price ?? null, ask1: a?.ask_price ?? null });
      }
    }

    const items = ticks.map((t) => {
      const changePct = (t.signed_change_rate || 0) * 100;
      const ob = orderbookMap.get(t.market) || {};
      const stopLoss = t.low_price ? Math.round(t.low_price * 0.98) : null;
      return {
        exchange: "업비트",
        symbol: t.market, // KRW-BTC
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
    } else if (qRaw) {
      const scored = items
        .map((it) => {
          const toks = aliasTokens(it.symbol, it.name);
          return { it, sc: scoreItem(qNorm, toks) };
        })
        .filter((x) => x.sc > 0)
        .sort((a, b) => b.sc - a.sc || b.it.changePct - a.it.changePct)
        .slice(0, 30)
        .map((x) => x.it);
      out = scored;
    }

    return new Response(JSON.stringify({ exchange: "업비트", items: out }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*"
      }
    });
  }
}
