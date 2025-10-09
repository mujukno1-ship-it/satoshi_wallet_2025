export const config = { runtime: "edge" };

/** ----------------------------------------------------------------
 *  /api/tickers  (안정 복원판)
 *  - 기존 스키마 100% 유지
 *  - 항상 JSON 반환 (ok:true/false)
 *  - 업비트 공개 API 사용 (market/all, ticker, orderbook)
 *  - 검색어 q 지원 (한글/영문/심볼)
 * ---------------------------------------------------------------- */
const TIMEOUT = 10000;

// ---------- 유틸 ----------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const toArr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

async function withTimeout(promise, ms = TIMEOUT) {
  let timer;
  const killer = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, killer]);
  } finally {
    clearTimeout(timer);
  }
}

async function j(url) {
  const r = await withTimeout(
    fetch(url, { headers: { accept: "application/json" } }),
    TIMEOUT
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---------- 검색어 정규화 & 매칭 ----------
const THESAURUS = {
  btc: ["btc", "비트", "비트코인", "bitcoin"],
  eth: ["eth", "이더", "이더리움", "ethereum"],
  etc: ["etc", "이더리움클래식", "ethereum classic"],
  xrp: ["xrp", "리플"],
};
function normalize(s) {
  return (s || "").toString().trim().toLowerCase();
}
function synonyms(q) {
  const n = normalize(q);
  if (!n) return [];
  for (const k of Object.keys(THESAURUS)) {
    if (THESAURUS[k].includes(n)) return THESAURUS[k];
  }
  return [n];
}
function matchesQuery(m, qNorm) {
  if (!qNorm) return true;
  const qs = synonyms(qNorm);
  const kor = (m.korean_name || "").toLowerCase();
  const eng = (m.english_name || "").toLowerCase();
  const sym = (m.market || "").toLowerCase();
  return qs.some(
    (x) => kor.includes(x) || eng.includes(x) || sym.includes(x)
  );
}

// ---------- 외부 API ----------
async function getKRWMarkets() {
  try {
    const all = await j("https://api.upbit.com/v1/market/all?isDetails=true");
    return all.filter((m) => (m.market || "").startsWith("KRW-"));
  } catch (e) {
    console.error("⚠️ Upbit Market API 오류:", e.message || e);
    // fallback 최소값 (API 제한/오류 시에도 화면이 멈추지 않게)
    return [{ market: "KRW-BTC", korean_name: "비트코인", english_name: "Bitcoin" }];
  }
}


async function getTickers(codes) {
  if (!codes.length) return [];
  const chunks = chunk(codes, 100);
  const results = [];
  for (const c of chunks) {
    const url =
      "https://api.upbit.com/v1/ticker?markets=" + encodeURIComponent(c.join(","));
    results.push(...(await j(url)));
    await sleep(30);
  }
  return results;
}

async function getOrderbooks(codes) {
  if (!codes.length) return {};
  const chunks = chunk(codes, 100);
  const map = {};
  for (const c of chunks) {
    const url =
      "https://api.upbit.com/v1/orderbook?markets=" +
      encodeURIComponent(c.join(","));
    const arr = await j(url);
    for (const ob of arr) {
      const unit = ob.orderbook_units?.[0] || {};
      map[ob.market] = {
        bid_price: Number(unit.bid_price) || 0,
        ask_price: Number(unit.ask_price) || 0,
      };
    }
    await sleep(30);
  }
  return map;
}

// ---------- 응답 구성 ----------
function toRow(u, m, ob) {
  const now = Number(u.trade_price) || 0;

  // 원호가 (업비트 호가 그대로, 반올림 없음)
  const bid = Number(ob?.bid_price ?? u.bid_price ?? now);
  const ask = Number(ob?.ask_price ?? u.ask_price ?? now);

  // 간단 타점 (기존 스키마 유지: B1/TP1/SL 모두 반드시 숫자)
  const B1 = now ? now * 0.997 : 0;   // 매수 진입 약 -0.3%
  const TP1 = now ? now * 1.008 : 0;  // 익절 약 +0.8%
  const SL = now ? now * 0.985 : 0;   // 손절 약 -1.5%

  // 위험도: 변동률 기반(1~5)
  const ch = Math.abs(Number(u.signed_change_rate) || 0);
  const risk = ch > 0.06 ? 5 : ch > 0.04 ? 4 : ch > 0.025 ? 3 : ch > 0.012 ? 2 : 1;

  return {
    symbol: m.market,
    nameKr: m.korean_name,
    now,
    order: { bid, ask }, // ✅ 원본 호가
    targets: { long: { B1, TP1, SL } },
    change: Number(u.signed_change_rate) || 0,
    warmState: "중립",
    risk,
    comment: "-",
    startTime: null,
    endTime: null,
    badges: [],
  };
}

function buildSpikes(rows) {
  const xs = [...rows];
  xs.sort((a, b) => (b.change || 0) - (a.change || 0));
  const hot = xs.slice(0, 6).map((r) => ({ symbol: r.symbol, pct: r.change }));
  xs.sort((a, b) => (a.change || 0) - (b.change || 0));
  const cold = xs.slice(0, 6).map((r) => ({ symbol: r.symbol, pct: r.change }));
  return { hot, cold };
}

// ---------- 핸들러 ----------
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const q = url.searchParams.get("q") || "";
    const qNorm = normalize(q);

    // 마켓 목록
    const markets = await getKRWMarkets();
    const pool = qNorm ? markets.filter((m) => matchesQuery(m, qNorm)) : markets;

    // 과도한 쿼리 방지 (최대 120개)
    const codes = pool.slice(0, 120).map((m) => m.market);

    // 시세/호가
    const [tArr, obMap] = await Promise.all([
      getTickers(codes),
      getOrderbooks(codes),
    ]);

    // rows
    const rows = tArr.map((u) => {
      const m = pool.find((x) => x.market === u.market) || {};
      const ob = obMap[u.market] || {};
      return toRow(u, m, ob);
    });

    // spikes (급등/급락 박스)
    const spikes = buildSpikes(rows);

    return res.status(200).json({
      ok: true,
      rows,
      tickers: rows,     // ← 백워드 호환
      spikes,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error("[/api/tickers] error:", e);
    return res.status(200).json({
      ok: false,
      error: e.message || String(e),
      rows: [],
      tickers: [],
      spikes: {},
      updatedAt: Date.now(),
    });
  }
}
