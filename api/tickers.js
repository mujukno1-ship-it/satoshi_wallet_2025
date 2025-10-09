// /api/tickers.js — 공개 API 단일 파일 (기능 유지 + 검색 + 급등/급락 + 강력 오류가드)
const UPBIT = "https://api.upbit.com/v1";
const TIMEOUT_MS = 4500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = async (p, ms = TIMEOUT_MS) => {
  let t; const killer = new Promise((_, rej) => t = setTimeout(() => rej(new Error("timeout")), ms));
  try { return await Promise.race([p, killer]); } finally { clearTimeout(t); }
};
const safe = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

async function fetchJson(url){
  const res = await withTimeout(fetch(url, { headers: { accept: "application/json" } }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function marketsKRW(){
  const list = await fetchJson(`${UPBIT}/market/all?isDetails=true`);
  return list.filter(m => m.market?.startsWith("KRW-"))
             .map(m => ({ market:m.market, korean_name:m.korean_name, english_name:m.english_name }));
}

async function getTickerMap(markets){
  if (!markets.length) return {};
  const chunks = [];
  for (let i=0;i<markets.length;i+=80) chunks.push(markets.slice(i,i+80));
  const results = await Promise.all(chunks.map(async ch => {
    try {
      const qs = encodeURIComponent(ch.join(","));
      return await fetchJson(`${UPBIT}/ticker?markets=${qs}`);
    } catch { return []; }
  }));
  const map = {};
  for (const t of results.flat()) map[t.market] = t;
  return map; // { "KRW-BTC": { ... } }
}

async function getCandles1m(market, count=6){
  const rows = await fetchJson(`${UPBIT}/candles/minutes/1?market=${market}&count=${count}`);
  return rows.slice().reverse().map(r => ({
    time: new Date(r.timestamp).getTime(),
    open: safe(r.opening_price), high: safe(r.high_price),
    low: safe(r.low_price), close: safe(r.trade_price),
    volume: safe(r.candle_acc_trade_volume)
  }));
}

function upbitTick(price){
  const p = +price;
  if (p>=2000000) return 1000;
  if (p>=1000000) return 500;
  if (p>= 500000) return 100;
  if (p>= 100000) return 50;
  if (p>=  10000) return 10;
  if (p>=   1000) return 1;
  if (p>=    100) return 0.1;
  if (p>=     10) return 0.01;
  return 0.001;
}
const roundTick = (x)=>{ const t=upbitTick(x); return Math.round(x/t)*t; };

function stateFrom(change){
  if (change > 5)  return "급등🚀";
  if (change > 2)  return "예열♨️";
  if (change < -5) return "급락⚠️";
  return "중립";
}

export default async function handler(req, res){
  try{
    const url = new URL(req.url, "http://localhost");
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // 1) 마켓 풀
    const all = await marketsKRW();
    const pool = q
      ? all.filter(m => {
          const name=(m.korean_name||"").toLowerCase();
          const eng =(m.english_name||"").toLowerCase();
          const sym =(m.market||"").toLowerCase().replace("krw-","");
          const qq  = q.replace("krw-","");
          return name.includes(q) || eng.includes(q) || sym.includes(qq);
        })
      : all.slice(0,50); // 기본 과부하 방지

    const codes = pool.map(m=>m.market);

    // 2) 현재가
    const tMap = await getTickerMap(codes);

    // 3) 최근 1분봉 2개(변동률용 prev close)
    const prevClose = {};
    await Promise.all(codes.map(async c=>{
      try{
        const arr = await getCandles1m(c,2);
        prevClose[c] = arr.at(-2)?.close ?? tMap[c]?.prev_closing_price ?? 0;
        await sleep(15); // 429 회피 미세대기
      }catch{
        prevClose[c] = tMap[c]?.prev_closing_price ?? 0;
      }
    }));

    // 4) rows 구성 (기존 컬럼 호환 필드 포함)
    const rows = pool.map(m=>{
      const tk = tMap[m.market]; if(!tk) return null;
      const now  = roundTick(safe(tk.trade_price));
      const prev = safe(prevClose[m.market], tk.prev_closing_price);
      const change = prev ? round(((now-prev)/prev)*100, 2) : 0;
      const warmState = stateFrom(change);
      return {
        symbol: m.market,
        nameKr: m.korean_name,
        now,
        buy: "-", sell: "-",                // 기존 표 호환용
        sl: roundTick(now*0.98), tp: roundTick(now*1.02),
        risk: 1,
        warmState,
        warmMeta: { changePct: change, volRatio: 1 },
        targets: { long: { B1: roundTick(now*0.985), TP1: roundTick(now*1.015) } }
      };
    }).filter(Boolean);

    // 5) 급등/급락 세트
    const spikes = {
      up: rows.filter(r=>r.warmMeta.changePct>=5).sort((a,b)=>b.warmMeta.changePct-a.warmMeta.changePct).slice(0,8),
      down: rows.filter(r=>r.warmMeta.changePct<=-5).sort((a,b)=>a.warmMeta.changePct-b.warmMeta.changePct).slice(0,8),
    };

    // 6) 응답 (항상 200)
    res.statusCode = 200;
    res.setHeader("content-type","application/json; charset=utf-8");
    res.end(JSON.stringify({
      ok:true,
      updatedAt: Date.now(),
      rows,
      spikes,
      tickers: Object.values(tMap) // 프론트에서 배열로 바로 사용 가능
    }));
  }catch(err){
    // 절대 500 내지 않음
    res.statusCode = 200;
    res.setHeader("content-type","application/json; charset=utf-8");
    res.end(JSON.stringify({ ok:false, error:String(err?.message||err), rows:[], spikes:{up:[],down:[]}, tickers:[] }));
  }
}
