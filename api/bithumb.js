export const config = { runtime: "edge" };

// ──────────────────────────────
// 공통 유틸: 검색 정규화 + 별칭/별명 매칭 (업비트와 동일)
// ──────────────────────────────
function norm(s = "") {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "")
    .replace(/코인/g, "")
    .replace(/캐쉬/g, "캐시");
}

const ALIAS = {
  BTC: ["비트", "비트코인", "빗코", "비코", "bitcoin", "btc"],
  BCH: ["비트코인캐시", "비트코인캐쉬", "비캐", "bitcoin cash", "bitcoincash", "bch"],
  ETH: ["이더", "이더리움", "eth", "ethereum"],
  XRP: ["리플", "xrp"],
  ADA: ["에이다", "ada"],
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
  let sc = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (t === qNorm) sc += 100;
    else if (t.startsWith(qNorm)) sc += 50;
    else if (t.includes(qNorm)) sc += 10;
  }
  return sc;
}

function riskFromPct(p) {
  const ap = Math.abs(p);
  if (ap < 3) return "낮음";
  if (ap < 7) return "중간";
  return "높음";
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const wantTop = searchParams.get("top");
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 8)));
    const qRaw = (searchParams.get("q") || "").trim();
    const qNorm = norm(qRaw);

    // 빗썸 ALL 티커
    const all = await getJson("https://api.bithumb.com/public/ticker/ALL_KRW");
    if (all.status !== "0000") throw new Error("bithumb error");

    const items = Object.entries(all.data)
      .filter(([sym]) => sym !== "date")
      .map(([sym, v]) => {
        const price = Number(v.closing_price);
        const open = Number(v.opening_price || v.prev_closing_price || price);
        const high = Number(v.max_price || price);
        const low = Number(v.min_price || price);
        const changePct = open ? ((price - open) / open) * 100 : 0;
        const stopLoss = Math.round(low * 0.98);
        // 한글명 없을 때 심볼로 대체 (필요하면 추가 매핑)
        const name = ALIAS[sym]?.[0] || sym;
        return {
          exchange: "빗썸",
          symbol: `KRW-${sym}`,
          name,
          price,
          changePct: Number(changePct.toFixed(2)),
          high,
          low,
          bid1: Number(v.bid_price || 0) || null,
          ask1: Number(v.ask_price || 0) || null,
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

    return new Response(JSON.stringify({ exchange: "빗썸", items: out }), {
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
