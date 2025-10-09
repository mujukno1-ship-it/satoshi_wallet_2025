// /api/tickers.js — 기존기능 유지 + 업비트 호가 정합 + 검색 + 오류가드
const UPBIT = "https://api.upbit.com/v1";
const TIMEOUT = 6000;

// ======= 유틸 =======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

async function withTimeout(p, ms = TIMEOUT) {
  let t;
  const killer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error("timeout")), ms)));
  try { return await Promise.race([p, killer]); }
  finally { clearTimeout(t); }
}

async function j(url) {
  const r = await withTimeout(fetch(url, { headers: { accept: "application/json" } }));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// 호가단위(업비트 KRW)
function tickKRW(p) {
  const x = +p;
  if (x >= 2000000) return 1000;
  if (x >= 1000000) return 500;
  if (x >=  500000) return 100;
  if (x >=  100000) return 50;
  if (x >=   10000) return 10;
  if (x >=    1000) return 1;
  if (x >=     100) return 0.1;
  if (x >=      10) return 0.01;
  if (x >=       1) return 0.001;
  return 0.0001;
}
const roundTick = (x) => { const t = tickKRW(x); return Math.round(x / t) * t; };

// 동의어(검색 강화)
const THESAURUS = {
  ETH: ["eth","이더","이더리움","ethereum"],
  ETC: ["etc","이더리움클래식","이더클","ethereum classic"],
  ENS: ["ens","이더리움네임서비스","네임서비스","ethereum name service"],
  BTC: ["btc","비트","비트코인","bitcoin"],
  BCH: ["bch","비캐","비트코인캐시","bitcoin cash"],
};
function normalize(s=""){
  return s.toString().trim().toLowerCase()
    .normalize("NFKD").replace(/krw-/g,"").replace(/[\s\-_]/g,"");
}
function matchesQuery(marketObj, qNorm){
  if (!qNorm) return true;
  const sym = normalize(marketObj.market);
  const kor = normalize(marketObj.korean_name||"");
  const eng = normalize(marketObj.english_name||"");
  if (sym.includes(qNorm) || kor.includes(qNorm) || eng.includes(qNorm)) return true;
  // 동의어
  for (const [symb, arr] of Object.entries(THESAURUS)) {
    const hit = arr.some(v=>normalize(v)===qNorm);
    if (hit) {
      // 심볼 완전매칭
      if (normalize(marketObj.market.replace("KRW-","")) === normalize(symb)) return true;
      if (kor.includes(qNorm) || eng.includes(qNorm)) return true;
    }
  }
  return false;
}

// ======= 핵심 로직 =======
async function getKRWMarkets() {
  const list = await j(`${UPBIT}/market/all?isDetails=true`);
  return list.filter(m=>m.market?.startsWith("KRW-"))
             .map(m=>({ market:m.market, korean_name:m.korean_name, english_name:m.english_name }));
}

async function getTickers(markets) {
  if (!markets.length) return [];
  const out = [];
  for (let i=0;i<markets.length;i+=80) {
    const sub = markets.slice(i,i+80);
    const qs = encodeURIComponent(sub.join(","));
    const arr = await j(`${UPBIT}/ticker?markets=${qs}`);
    out.push(...arr);
    await sleep(20);
  }
  return out; // 배열
}

async function getOrderbooks(markets) {
  if (!markets.length) return {};
  const out = {};
  for (let i=0;i<markets.length;i+=40) {
    const sub = markets.slice(i,i+40);
    const qs = encodeURIComponent(sub.join(","));
    const arr = await j(`${UPBIT}/orderbook?markets=${qs}`);
    for (const ob of arr) {
      const u = ob.orderbook_units?.[0];
      out[ob.market] = {
        bid: safe(u?.bid_price, 0),
        ask: safe(u?.ask_price, 0),
      };
    }
    await sleep(20);
  }
  return out; // map
}

function toRow(m, tk, ob, prevClose) {
  if (!tk) return null;
  const now = roundTick(safe(tk.trade_price));
  const bid = ob?.bid ? roundTick(ob.bid) : now; // 1호가 매수
  const ask = ob?.ask ? roundTick(ob.ask) : now; // 1호가 매도
  const prev = safe(prevClose ?? tk.prev_closing_price, now);
  const change = prev ? round(((now - prev) / prev) * 100, 2) : 0;

  // 기본 타깃(서버에 미지정 시)
  const B1  = roundTick(now * 0.985);
  const TP1 = roundTick(now * 1.015);
  const SL  = roundTick(B1 - tickKRW(B1));

  // 위험도(간단 스텁: 변동성/가격대 반영, 1~5)
  const risk = Math.min(5, Math.max(1,
    (Math.abs(change) >= 10 ? 4 : Math.abs(change) >= 5 ? 3 : 2)
  ));

  // 예열 상태(간단 스텁)
  const warmState = change > 2 ? "예열♨️" : change < -5 ? "급락⚠️" : "중립";

  return {
    symbol: m.market,
    nameKr: m.korean_name,
    now,
    order: { bid, ask },
    targets: { long: { B1, TP1, SL } },
    change,
    warmState,
    risk,
    comment: "-",            // (필요 시 서버에서 채워도 됨)
    startTime: null,         // 예열 시작(옵션)
    endTime: null,           // 예열 종료(옵션)
    badges: []               // 5m/15m/30m 뱃지(옵션)
  };
}

export default async function handler(req, res) {
  try {
    // 1) 쿼리 파싱
    const url = new URL(req.url, "http://localhost");
    const qNorm = normalize(url.searchParams.get("q") || "");

    // 2) 마켓 목록
    const markets = await getKRWMarkets();
    const pool = qNorm ? markets.filter(m => matchesQuery(m, qNorm)) : markets;

    // 3) 티커 + 주문호가
    const codes = pool.map(m=>m.market);
    const [tickersArr, obMap] = await Promise.all([
      getTickers(codes),
      getOrderbooks(codes),
    ]);
    const tickerMap = Object.fromEntries(tickersArr.map(t=>[t.market, t]));

    // prevClose 간단 버전(필요시 1분봉 확장 가능)
    const prevClose = {}; // 스텁: tk.prev_closing_price 사용
    for (const c of codes) prevClose[c] = tickerMap[c]?.prev_closing_price;

    // 4) rows 생성
    const rows = pool.map(m => toRow(m, tickerMap[m.market], obMap[m.market], prevClose[m.market]))
                     .filter(Boolean);

    // 5) 급등/급락 세트
    const spikes = {
      up: rows.filter(r=>r.change >= 5).sort((a,b)=>b.change-a.change).slice(0,8),
      down: rows.filter(r=>r.change <= -5).sort((a,b)=>a.change-b.change).slice(0,8),
    };

    // 6) 응답
    res.statusCode = 200;
    res.setHeader("content-type","application/json; charset=utf-8");
    res.end(JSON.stringify({
      ok: true,
      updatedAt: Date.now(),
      rows,
      spikes,
      // tickers는 프론트 보조용(검색/예열용) — 배열 보장
      tickers: tickersArr
    }));
  } catch (e) {
    res.statusCode = 200;
    res.setHeader("content-type","application/json; charset=utf-8");
    res.end(JSON.stringify({ ok:false, error:String(e?.message||e), rows:[], spikes:{up:[],down:[]}, tickers:[] }));
  }
}
