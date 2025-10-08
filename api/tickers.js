// /api/tickers.js — 검색 작동 + 급등/급락 세트 + 공개 API만 사용
import { marketsKRW, getTickerFast, getCandles1mFast } from "../lib/upbit_private.js";

const safeNum = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

function upbitTick(price){
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
const roundTick = (price) => { const t = upbitTick(price); return Math.round(price / t) * t; };

function detectState(changePct){
  if (changePct > 5) return "급등🚀";
  if (changePct > 2) return "예열♨️";
  if (changePct < -5) return "급락⚠️";
  return "중립";
}

export default async function handler(req, res){
  try{
    const url = new URL(req.url, "http://localhost");
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // 1) 전체 마켓 목록
    const markets = await marketsKRW(); // [{market, korean_name, english_name}]
    // 🔎 검색어가 있으면 여기서부터 필터 (속도/부하 ↓)
    const pool = q
      ? markets.filter(m => {
          const name = (m.korean_name || "").toLowerCase();
          const eng  = (m.english_name || "").toLowerCase();
          const sym  = (m.market || "").toLowerCase();
          return name.includes(q) || eng.includes(q) || sym.includes(q.replace("krw-",""));
        })
      : markets.slice(0, 50); // 초보자용: 처음엔 50개만

    const codes = pool.map(m => m.market);

    // 2) 티커 맵(객체) → 나중에 rows 만들 때 사용
    const tickerMap = await getTickerFast(codes); // { "KRW-BTC": { ... } }
    const tickersArr = Object.values(tickerMap);  // 배열형도 같이 제공

    // 3) 각 심볼 1분봉 (최근값만 필요하면 upbit_private에서 최신 한 개만 가져오게 구현)
    const candles = await Promise.all(codes.map(async (c) => {
      try{
        const arr = await getCandles1mFast(c, 6); // 최신 6개(평균/변동률 계산용)
        return { market: c, list: arr };
      }catch{ return { market: c, list: [] }; }
    }));
    const lastCloseMap = Object.fromEntries(candles.map(({market, list}) => {
      const prev = list?.at(-2)?.close ?? tickerMap[market]?.prev_closing_price ?? 0;
      return [market, prev];
    }));

    // 4) rows 구성
    const rows = pool.map(m => {
      const tk = tickerMap[m.market]; if (!tk) return null;
      const now = roundTick(safeNum(tk.trade_price));
      const prev = safeNum(lastCloseMap[m.market], tk.prev_closing_price);
      const changePct = prev ? round(((now - prev) / prev) * 100, 2) : 0;
      const state = detectState(changePct);

      return {
        symbol: m.market,
        nameKr: m.korean_name,
        now,
        warmState: state,
        targets: {
          long: {
            B1: roundTick(now * 0.985),
            TP1: roundTick(now * 1.015)
          }
        },
        change: changePct
      };
    }).filter(Boolean);

    // 5) 급등/급락 세트
    const spikes = {
      up: rows.filter(r => r.change >= 5).sort((a,b)=>b.change-a.change).slice(0,8),
      down: rows.filter(r => r.change <= -5).sort((a,b)=>a.change-b.change).slice(0,8),
    };

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: true,
      updatedAt: Date.now(),
      rows,
      spikes,
      tickers: tickersArr, // ✅ 프론트에서 항상 배열로 사용 가능
    }));
  }catch(err){
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok:false, error:String(err?.message||err), rows:[], spikes:{up:[],down:[]}, tickers:[] }));
  }
}
