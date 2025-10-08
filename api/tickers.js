// /api/tickers.js — 통합 API (기존기능유지 + 급등/급락 세트 + 오류가드)
// Vercel/Static Serverless에서 동작
const UPBIT = "https://api.upbit.com/v1";
const TIMEOUT_MS = 3500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = async (p, ms = TIMEOUT_MS) => {
  let t; const killer = new Promise((_, rej) => t = setTimeout(() => rej(new Error("timeout")), ms));
  try { return await Promise.race([p, killer]); } finally { clearTimeout(t); }
};
const safeNum = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// 업비트 호가단위 반올림
function upbitTick(price) {
  const p = Number(price);
  if (p >= 2000000) return 1000;
  if (p >= 1000000) return 500;
  if (p >= 500000) return 100;
  if (p >= 100000) return 50;
  if (p >= 10000) return 10;
  if (p >= 1000) return 1;
  if (p >= 100) return 0.1;
  if (p >= 10) return 0.01;
  return 0.001;
}
const roundTick = (price) => {
  const t = upbitTick(price);
  return Math.round(price / t) * t;
};

// ===== 보조지표
function ema(values, period) {
  if (!values.length) return null;
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 1; i < values.length; i++) prev = values[i] * k + prev * (1 - k);
  return prev;
}
function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  let avgG = g / period, avgL = l / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const pg = Math.max(d, 0), pl = Math.max(-d, 0);
    avgG = (avgG * (period - 1) + pg) / period;
    avgL = (avgL * (period - 1) + pl) / period;
  }
  const rs = avgL === 0 ? 100 : avgG / (avgL || 1e-9);
  return 100 - 100 / (1 + rs);
}
function atr(ohlc, period = 14) {
  if (!ohlc || ohlc.length < period + 1) return null;
  const tr = [];
  for (let i = 1; i < ohlc.length; i++) {
    const h = ohlc[i].high, lw = ohlc[i].low, pc = ohlc[i - 1].close;
    tr.push(Math.max(h - lw, Math.abs(h - pc), Math.abs(lw - pc)));
  }
  let a = tr.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < tr.length; i++) a = (a * (period - 1) + tr[i]) / period;
  return a;
}

// ===== 급등/급락 탐지
function detectSpike(ohlc) {
  if (!ohlc || ohlc.length < 6) return { state: "정상", volRatio: 1, changePct: 0 };
  const last = ohlc.at(-1);
  const prev = ohlc.slice(-6, -1);
  const avgVol = prev.reduce((a, b) => a + safeNum(b.volume, 0), 0) / prev.length || 1;
  const avgClose = prev.reduce((a, b) => a + safeNum(b.close, last.close), 0) / prev.length || last.close;

  const volRatio = safeNum(last.volume, 0) / avgVol;
  const changePct = ((safeNum(last.close, avgClose) - avgClose) / avgClose) * 100;

  let state = "정상";
  if (volRatio > 5 && changePct > 5) state = "과열🔥";
  else if (volRatio > 3 && changePct > 3) state = "급등🚀";
  else if (volRatio > 2 && changePct > 1) state = "예열♨️";
  else if (volRatio > 3 && changePct < -3) state = "급락⚠️";

  return { state, volRatio: round(volRatio, 2), changePct: round(changePct, 2) };
}

// ===== Upbit REST
async function fetchJson(url) {
  const res = await withTimeout(fetch(url, { headers: { accept: "application/json" } }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function getAllMarketsKRW() {
  const list = await fetchJson(`${UPBIT}/market/all?isDetails=true`);
  return list
    .filter((m) => m.market?.startsWith("KRW-"))
    .map((m) => ({ market: m.market, korean_name: m.korean_name, english_name: m.english_name }));
}
async function getTicker(markets) {
  if (!markets.length) return {};
  const qs = encodeURIComponent(markets.join(","));
  const arr = await fetchJson(`${UPBIT}/ticker?markets=${qs}`);
  const map = {}; for (const t of arr) map[t.market] = t; return map;
}
async function getCandles1m(market, count = 60) {
  const url = `${UPBIT}/candles/minutes/1?market=${market}&count=${count}`;
  const rows = await fetchJson(url);
  return rows.slice().reverse().map((r) => ({
    time: new Date(r.timestamp).getTime(),
    open: safeNum(r.opening_price),
    high: safeNum(r.high_price),
    low: safeNum(r.low_price),
    close: safeNum(r.trade_price),
    volume: safeNum(r.candle_acc_trade_volume),
  }));
}

// ===== 타점 생성(위험도1, 보수)
function buildTargets(ohlc, last) {
  const closes = ohlc.map((c) => c.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(ohlc, 14);

  const price = last;
  const vwap = round(
    ohlc.reduce((a, c) => a + c.close * c.volume, 0) /
      Math.max(ohlc.reduce((a, c) => a + c.volume, 0), 1), 2);

  const trendUp = price > ema20 && ema20 > ema50;
  const trendDn = price < ema20 && ema20 < ema50;
  const longOK = trendUp && rsi14 >= 45 && rsi14 <= 68;
  const shortOK = trendDn && rsi14 <= 55 && rsi14 >= 32;

  const atrMulBuy = [0.5, 1.0, 1.5];
  const atrMulTake = [0.75, 1.5, 2.25];
  const slMul = 1.2;

  const B1 = roundTick(vwap - atrMulBuy[0] * atr14);
  const B2 = roundTick(vwap - atrMulBuy[1] * atr14);
  const B3 = roundTick(vwap - atrMulBuy[2] * atr14);
  const TP1 = roundTick(vwap + atrMulTake[0] * atr14);
  const TP2 = roundTick(vwap + atrMulTake[1] * atr14);
  const TP3 = roundTick(vwap + atrMulTake[2] * atr14);
  const SL_long = roundTick(B2 - slMul * atr14);

  const S1 = roundTick(vwap + atrMulBuy[0] * atr14);
  const S2 = roundTick(vwap + atrMulBuy[1] * atr14);
  const S3 = roundTick(vwap + atrMulBuy[2] * atr14);
  const TP1s = roundTick(vwap - atrMulTake[0] * atr14);
  const TP2s = roundTick(vwap - atrMulTake[1] * atr14);
  const TP3s = roundTick(vwap - atrMulTake[2] * atr14);
  const SL_short = roundTick(S2 + slMul * atr14);

  let signal = "관망";
  if (longOK) signal = "Long↗";
  else if (shortOK) signal = "Short↘";

  return {
    signal,
    ema20: roundTick(ema20),
    ema50: roundTick(ema50),
    rsi14: round(rsi14, 1),
    atr14: Math.round(atr14),
    long: { B1, B2, B3, TP1, TP2, TP3, SL: SL_long },
    short: { S1, S2, S3, TP1: TP1s, TP2: TP2s, TP3: TP3s, SL: SL_short },
  };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    const marketsAll = await getAllMarketsKRW();
    const pool = (() => {
      if (!q) return marketsAll.slice(0, 20);
      return marketsAll
        .filter(m =>
          m.korean_name.toLowerCase().includes(q) ||
          m.english_name.toLowerCase().includes(q) ||
          m.market.toLowerCase().includes(q))
        .slice(0, 20);
    })();

    const codes = pool.map(m => m.market);
    const tkMap = await getTicker(codes);

    const rows = [];
    for (const m of pool) {
      try {
        const tk = tkMap[m.market]; if (!tk) continue;
        const now = roundTick(safeNum(tk.trade_price));
        const ohlc = await getCandles1m(m.market, 60);
        if (!ohlc.length) continue;

        const spike = detectSpike(ohlc);
        let targets = buildTargets(ohlc, now);

        // 급등/급락 반응형 보정
        if (spike.state.includes("급등")) {
          targets.long.TP1 = roundTick(targets.long.TP1 * 0.99);
          targets.long.TP2 = roundTick(targets.long.TP2 * 0.985);
          targets.long.TP3 = roundTick(targets.long.TP3 * 0.98);
        } else if (spike.state.includes("급락")) {
          targets.short.S1 = roundTick(targets.short.S1 * 1.01);
          targets.short.S2 = roundTick(targets.short.S2 * 1.015);
          targets.short.S3 = roundTick(targets.short.S3 * 1.02);
        }

        rows.push({
          symbol: m.market,
          nameKr: m.korean_name,
          now,
          buy: "-",              // 기존 표 컬럼 호환
          sell: "-",
          sl: targets.long.SL,
          tp: targets.long.TP1,
          risk: 1,
          warmState: spike.state,
          warmMeta: { changePct: spike.changePct, volRatio: spike.volRatio },
          ohlc,
          targets
        });
        await sleep(30); // 429 회피
      } catch { /* 개별 종목 에러시 스킵 */ }
    }

    const scored = rows.map(r => ({
      symbol: r.symbol, nameKr: r.nameKr, now: r.now,
      state: r.warmState,
      changePct: r.warmMeta?.changePct ?? 0,
      volRatio: r.warmMeta?.volRatio ?? 0,
      score: Math.abs(r.warmMeta?.changePct ?? 0) * (r.warmMeta?.volRatio ?? 0)
    }));

    const spikes = {
      up: scored.filter(x => x.state.includes("급등") || x.state.includes("과열"))
                .sort((a,b)=>b.score - a.score).slice(0,8),
      down: scored.filter(x => x.state.includes("급락"))
                  .sort((a,b)=>b.score - a.score).slice(0,8)
    };

    res.statusCode = 200;
    res.setHeader("content-type","application/json; charset=utf-8");
    res.end(JSON.stringify({ ok:true, updatedAt: Date.now(), count: rows.length, rows, spikes }));
  } catch (err) {
    res.statusCode = 200;
    res.setHeader("content-type","application/json; charset=utf-8");
    res.end(JSON.stringify({ ok:false, error: String(err?.message || err), rows: [], spikes:{up:[],down:[]} }));
  }
}
