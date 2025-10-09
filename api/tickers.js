// /api/tickers.js — 공개 API 단일 파일 버전 (의존성 없음, 500 방지)
// 기존 기능 유지 + 검색(q) + 급등/급락 세트 + 강력 오류가드

const UPBIT = "https://api.upbit.com/v1";
const TIMEOUT_MS = 4500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = async (p, ms = TIMEOUT_MS) => {
  let t; const killer = new Promise((_, rej) => t = setTimeout(() => rej(new Error("timeout")), ms));
  try { return await Promise.race([p, killer]); } finally { clearTimeout(t); }
};
const safeNum = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

async function fetchJson(url) {
  const res = await withTimeout(fetch(url, { headers: { accept: "application/json" } }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function marketsKRW() {
  const list = await fetchJson(`${UPBIT}/market/all?isDetails=true`);
  return list.filter(m => m.market?.startsWith("KRW-"))
             .map(m => ({ market: m.market, korean_name: m.korean_name, english_name: m.english_name }));
}

async function getTickerMap(markets) {
  if (!markets.length) return {};
  // upbit는 100개까지 한번에 가능 — 여유롭게 80개씩 chunk
  const chunks = [];
  for (let i = 0; i < markets.length; i += 80) chunks.push(markets.slice(i, i + 80));
  const results = await Promise.all(chunks.map(async (ch) => {
    const qs = encodeURIComponent(ch.join(","));
    try { return await fetchJson(`${UPBIT}/ticker?markets=${qs}`); }
    catch { return []; }
  }));
  const arr = results.flat();
  const map = {}; for (const t of arr) map[t.market] = t; return map;
}

async function getCandles1m(market, count = 6) {
  const rows = await fetchJson(`${UPBIT}/candles/minutes/1?market=${market}&count=${count}`);
  return rows.slice().reverse().map(r => ({
    time: new Date(r.timestamp).getTime(),
    open: safeNum(r.opening_price),
    high: safeNum(r.high_price),
    low: safeNum(r.low_price),
    close: safeNum(r.trade_price),
    volume: safeNum(r.candle_acc_trade_volume),
  }));
}

function upbitTick(price) {
  const p = Number(price);
  if (p >= 2000000) return 1000;
  if (p >= 1000000) return 500;
  if (p >= 500000)  return 100;
  if (p >= 100000)  return 50;
  if (p >= 10000)   return 10;
  if (p >= 1000)    return 1;
  if (p >= 100)     return 0.1;
  if (p >= 10)      return 0.01;
  return 0.001;
}
const roundTick = (price) => { const t = upbitTick(price); return Math.round(price / t) * t; };

function detectState(changePct){
  if (changePct > 5)  return "급등🚀";
  if (changePct > 2)  return "예열♨️";
  if (changePct < -5) return "급락⚠️";
  return "중립";
}

export default async function handler(req, res) {
  // 어떤 오류가 나도 200으로 내려가도록 최상단 try/catch로 감쌈
  try {
    const url = new URL(req.url, "http://localhost");
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // 1) 마켓 목록
    const mktsAll = await marketsKRW();
    const pool = q
      ? mktsAll.filter(m => {
          const name = (m.korean_name || "").toLowerCase();
          const eng  = (m.english_name || "").toLowerCase();
          const sym  = (m.market || "").toLowerCase().replace("krw-", "");
          const qq   = q.replace("krw-", "");
          return name.includes(q) || eng.includes(q) || sym.includes(qq);
        })
      : mktsAll.slice(0, 50); // 처음엔 50개만 (과부하 방지)

    const codes = pool.map(m => m.market);

    // 2) 현재가 맵
    const tickerMap = await getTickerMap(codes);

    // 3) prev close 계산용으로 각 심볼 1분봉(최근 2개) 가져오기
    const prevCloseMap = {};
    await Promise.all(codes.map(async (c) => {
      try {
        const arr = await getCandles1m(c, 2);
        prevCloseMap[c] = arr.at(-2)?.close ?? tickerMap[c]?.prev_closing_price ?? 0;
        await sleep(15); // 429 방지 미세 대기
      } catch {
        prevCloseMap[c] = tickerMap[c]?.prev_closing_price ?? 0;
      }
    }));

    // 4) rows 생성
    const rows = pool.map((m) => {
      const tk = tickerMap[m.market];
      if (!tk) return null;
      const now  = roundTick(safeNum(tk.trade_price));
      const prev = safeNum(prevCloseMap[m.market], tk.prev_closing_price);
      const changePct = prev ? round(((now - prev) / prev) * 100, 2) : 0;
      const warmState = detectState(changePct);

      return {
        symbol: m.market,
        nameKr: m.korean_name,
        now,
        change: changePct,
        warmState,
        targets: {
          long: {
            B1: roundTick(now * 0.985),
            TP1: roundTick(now * 1.015),
          },
        },
      };
    }).filter(Boolean);

    // 5) 급등/급락 세트
    const spikes = {
      up: rows.filter(r => r.change >= 5).sort((a,b)=>b.change-a.change).slice(0,8),
      down: rows.filter(r => r.change <= -5).sort((a,b)=>a.change-b.change).slice(0,8),
    };

    // 6) 응답 (무조건 200)
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      ok: true,
      updatedAt: Date.now(),
      rows,
      spikes,
      // tickers는 배열로도 쓸 수 있게 값만 제공
      tickers: Object.values(tickerMap),
    }));
  } catch (err) {
    // 여기까지 오더라도 500 대신 200 + ok:false 로 반환
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok:false, error: String(err?.message || err), rows: [], spikes: {up:[], down:[]}, tickers: [] }));
  }
}
