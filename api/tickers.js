// ✅ /api/tickers.js (최신 완성본)
// 기존 기능 유지 + 업비트 IP연동 모듈 사용 + 속도개선 + tickers.filter 오류 수정
// lib/upbit_private.js 기반

import { marketsKRW, getTickerFast, getCandles1mFast } from "../lib/upbit_private.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeNum = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// 호가단위 반올림
function upbitTick(price) {
  const p = Number(price);
  if (p >= 2_000_000) return 1000;
  if (p >= 1_000_000) return 500;
  if (p >=   500_000) return 100;
  if (p >=   100_000) return 50;
  if (p >=    10_000) return 10;
  if (p >=     1_000) return 1;
  if (p >=       100) return 0.1;
  if (p >=        10) return 0.01;
  return 0.001;
}
const roundTick = (price) => {
  const t = upbitTick(price);
  return Math.round(price / t) * t;
};

// EMA, RSI, ATR 계산
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

// 급등/급락 탐지
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

// 타점 생성
function buildTargets(ohlc, last) {
  const closes = ohlc.map(c => c.close);
  const ema20 = ema(closes, 20), ema50 = ema(closes, 50), rsi14 = rsi(closes, 14), atr14 = atr(ohlc, 14);

  const vwap = round(
    ohlc.reduce((a, c) => a + c.close * c.volume, 0) /
    Math.max(ohlc.reduce((a, c) => a + c.volume, 0), 1), 2
  );

  const trendUp = last > ema20 && ema20 > ema50;
  const trendDn = last < ema20 && ema20 < ema50;
  const longOK = trendUp && rsi14 >= 45 && rsi14 <= 68;
  const shortOK = trendDn && rsi14 <= 55 && rsi14 >= 32;

  const atrB = [0.5, 1.0, 1.5], atrT = [0.75, 1.5, 2.25], slMul = 1.2;

  const B1 = roundTick(vwap - atrB[0] * atr14);
  const B2 = roundTick(vwap - atrB[1] * atr14);
  const TP1 = roundTick(vwap + atrT[0] * atr14);
  const SL_long = roundTick(B2 - slMul * atr14);

  const S1 = roundTick(vwap + atrB[0] * atr14);
  const TP1s = roundTick(vwap - atrT[0] * atr14);
  const SL_short = roundTick(S1 + slMul * atr14);

  let signal = "관망";
  if (longOK) signal = "Long↗";
  else if (shortOK) signal = "Short↘";

  return {
    signal,
    ema20: roundTick(ema20),
    ema50: roundTick(ema50),
    rsi14: round(rsi14, 1),
    atr14: Math.round(atr14),
    long:  { B1, B2, TP1, SL: SL_long },
    short: { S1, TP1: TP1s, SL: SL_short },
  };
}

// === 메인 API ===
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    const marketsAll = await marketsKRW();
    const pool = (!q ? marketsAll.slice(0, 20)
      : marketsAll.filter(m =>
        m.korean_name.toLowerCase().includes(q) ||
        m.english_name.toLowerCase().includes(q) ||
        m.market.toLowerCase().includes(q)
      ).slice(0, 20)
    );

    const codes = pool.map(m => m.market);
    const tickerMap = await getTickerFast(codes);
    const tickersArr = Object.values(tickerMap); // 배열로 변환 (filter/map 오류 방지)

    const rows = [];
    for (const m of pool) {
      try {
        const tk = tickerMap[m.market]; if (!tk) continue;
        const now = roundTick(safeNum(tk.trade_price));
        const ohlc = await getCandles1mFast(m.market, 60); if (!ohlc.length) continue;

        const spike = detectSpike(ohlc);
        const targets = buildTargets(ohlc, now);

        rows.push({
          symbol: m.market,
          nameKr: m.korean_name,
          now,
          risk: 1,
          warmState: spike.state,
          warmMeta: { changePct: spike.changePct, volRatio: spike.volRatio },
          targets,
        });
        await sleep(30);
      } catch { /* 개별 실패 무시 */ }
    }

    const scored = rows.map(r => ({
      symbol: r.symbol,
      nameKr: r.nameKr,
      now: r.now,
      state: r.warmState,
      changePct: r.warmMeta?.changePct ?? 0,
      volRatio: r.warmMeta?.volRatio ?? 0,
      score: Math.abs(r.warmMeta?.changePct ?? 0) * (r.warmMeta?.volRatio ?? 0),
    }));

    const spikes = {
      up: scored.filter(x => x.state.includes("급등") || x.state.includes("과열"))
                .sort((a, b) => b.score - a.score).slice(0, 8),
      down: scored.filter(x => x.state.includes("급락"))
                  .sort((a, b) => b.score - a.score).slice(0, 8),
    };

    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      ok: true,
      updatedAt: Date.now(),
      rows,
      spikes,
      tickers: tickersArr,
    }));
  } catch (err) {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      ok: false,
      error: String(err?.message || err),
      rows: [],
      spikes: { up: [], down: [] },
      tickers: [],
    }));
  }
}
