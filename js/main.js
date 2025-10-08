// /js/main.js — 예열 스캔 + 급등 자동대체 + 검색 + 매수/매도 타점 + 위험도 + 한마디 + 60초 자동갱신

/******************
 * 설정값
 ******************/
const PREHEAT_MIN = 0.03;   // 예열 하한 (+3%)
const PREHEAT_MAX = 0.08;   // 급등 경계 (+8%)
const TOP_COUNT   = 10;     // 대체 표시 개수
const AUTO_REFRESH_SEC = 60;

/******************
 * 유틸
 ******************/
const fmtKRW = (x) => Number(x||0).toLocaleString("ko-KR");
const $ = (sel) => document.querySelector(sel);
const tbody = () => document.querySelector("#coin-table tbody") || document.querySelector("tbody");

// 마켓 캐시
let MARKETS = []; // [{market:'KRW-BTC', korean_name:'비트코인', ...}, ...]

async function loadMarkets() {
  const r = await fetch("/api/markets");
  if (!r.ok) throw new Error("markets load failed");
  MARKETS = await r.json();
  return MARKETS;
}

function findKoreanName(market) {
  const m = MARKETS.find(x => x.market === market);
  return m?.korean_name || market.replace("KRW-","");
}

/******************
 * 업비트 티커 다건 프록시 호출
 ******************/
async function fetchTickers(markets) {
  if (!markets.length) return [];
  const r = await fetch("/api/tickers?markets=" + encodeURIComponent(markets.join(",")));
  if (!r.ok) throw new Error("tickers fetch failed");
  return await r.json(); // [{market, trade_price, signed_change_rate, timestamp, ...}]
}

/******************
 * 타점/위험도/멘트
 ******************/
function analyze(price, changeRate) {
  let buy="-", sell="-", sl="-", tp="-", risk=2, msg="";

  if (changeRate >= PREHEAT_MAX) {                   // 급등/과열
    buy  = (price * 0.99).toFixed(0);
    sell = (price * 1.02).toFixed(0);
    sl   = (price * 0.97).toFixed(0);
    tp   = (price * 1.03).toFixed(0);
    risk = 4;
    msg  = "🔥 과열 가능 — 이익실현/분할매도 권장";
  } else if (changeRate >= PREHEAT_MIN) {            // 예열
    buy  = (price * 0.985).toFixed(0);
    sell = (price * 1.015).toFixed(0);
    sl   = (price * 0.972).toFixed(0);
    tp   = (price * 1.03).toFixed(0);
    risk = 2;
    msg  = "🚀 예열중 — 추세상승 가능성";
  } else if (changeRate <= -0.03) {                  // 하락권
    buy  = (price * 0.97).toFixed(0);
    sell = (price * 1.01).toFixed(0);
    sl   = (price * 0.955).toFixed(0);
    tp   = (price * 1.02).toFixed(0);
    risk = 3;
    msg  = "⚠️ 하락 추세 — 무리한 진입 금지";
  } else {                                           // 보합/안정
    buy  = (price * 0.995).toFixed(0);
    sell = (price * 1.01).toFixed(0);
    sl   = (price * 0.985).toFixed(0);
    tp   = (price * 1.02).toFixed(0);
    risk = 1;
    msg  = "✅ 안정 구간 — 분할매수 적합";
  }

  return { buy, sell, sl, tp, risk, msg };
}

/******************
 * 화면 렌더
 ******************/
function renderRow(t) {
  const name = findKoreanName(t.market);
  const price = t.trade_price;
  const chg = t.signed_change_rate; // -1 ~ +1
  const { buy, sell, sl, tp, risk, msg } = analyze(price, chg);

  // 예열 상태/시작/종료(예상) 간단 계산
  const preheat =
    chg >= PREHEAT_MAX ? "🔥 급등" :
    chg >= PREHEAT_MIN ? "🚀 예열"  :
    chg <= -0.03       ? "📉 하락"  : "—";

  const now = Date.now();
  const start = new Date(now - (chg >= PREHEAT_MIN ? 20*60*1000 : 10*60*1000))
    .toTimeString().slice(0,5);
  const end   = new Date(now + (chg >= PREHEAT_MIN ? 15*60*1000 : 10*60*1000))
    .toTimeString().slice(0,5);

  return `
  <tr>
    <td>${name}</td>
    <td>${fmtKRW(price)}</td>
    <td>${fmtKRW(buy)}</td>
    <td>${fmtKRW(sell)}</td>
    <td>${fmtKRW(sl)}</td>
    <td>${fmtKRW(tp)}</td>
    <td>${(chg*100).toFixed(2)}%</td>
    <td>${risk}</td>
    <td>${preheat}</td>
    <td>${start}</td>
    <td>${end}</td>
    <td>${msg}</td>
  </tr>`;
}

function renderEmpty(msg) {
  tbody().innerHTML = `<tr><td colspan="12" style="text-align:center;color:#666;">${msg}</td></tr>`;
}

/******************
 * 코어 로직
 ******************/
async function scanPreheatOrFallback() {
  // 테이블 비우고 로딩
  renderEmpty("불러오는 중…");

  // 마켓 목록
  if (!MARKETS.length) await loadMarkets();
  const krw = MARKETS.map(m => m.market);

  // 30개씩 나눠 티커 호출
  const chunks = Array.from({length: Math.ceil(krw.length/30)}, (_,i)=>
    krw.slice(i*30, i*30+30)
  );

  let all = [];
  for (const part of chunks) {
    try {
      const data = await fetchTickers(part);
      all = all.concat(data);
    } catch(e) { /* 일부 실패해도 계속 */ }
  }

  // 1) 예열(+3%~+8%) 우선
  const preheats = all
    .filter(t => (t.signed_change_rate||0) >= PREHEAT_MIN && (t.signed_change_rate||0) < PREHEAT_MAX)
    .sort((a,b) => (b.signed_change_rate||0) - (a.signed_change_rate||0))
    .slice(0, TOP_COUNT);

  if (preheats.length) {
    tbody().innerHTML = preheats.map(renderRow).join("");
    return;
  }

  // 2) 예열 없으면 → 급등(+8%) 자동대체
  const spikes = all
    .filter(t => (t.signed_change_rate||0) >= PREHEAT_MAX)
    .sort((a,b) => (b.signed_change_rate||0) - (a.signed_change_rate||0))
    .slice(0, TOP_COUNT);

  if (spikes.length) {
    tbody().innerHTML = spikes.map(renderRow).join("");
    return;
  }

  // 3) 그래도 없으면 → 전체 상승률 TOP10
  const topAny = all
    .sort((a,b) => (b.signed_change_rate||0) - (a.signed_change_rate||0))
    .slice(0, TOP_COUNT);

  if (topAny.length) {
    tbody().innerHTML = topAny.map(renderRow).join("");
  } else {
    renderEmpty("표시할 코인이 없습니다.");
  }
}

/******************
 * 검색 (한글명/영문/티커)
 ******************/
async function onSearch() {
  const q = ($("#search")?.value || "").trim().toLowerCase();
  if (!q) return scanPreheatOrFallback();

  if (!MARKETS.length) await loadMarkets();

  // 한글/영문/마켓코드 어디든 포함 매칭
  const found = MARKETS.filter(m =>
    (m.korean_name || "").toLowerCase().includes(q) ||
    (m.english_name || "").toLowerCase().includes(q) ||
    (m.market || "").toLowerCase().includes(q)
  ).slice(0, 15);

  if (!found.length) {
    renderEmpty("검색 결과 없음");
    return;
  }

  renderEmpty("검색 결과 불러오는 중…");
  const tickers = await fetchTickers(found.map(x => x.market));
  tbody().innerHTML = tickers.map(renderRow).join("");
}

/******************
 * 초기화 & 이벤트 & 자동갱신
 ******************/
async function init() {
  // 버튼 & 검색 이벤트 연결
  const scanBtn = document.getElementById("scanBtn") || document.querySelector("button#scanBtn") || document.querySelector(".scan-btn");
  if (scanBtn) {
    scanBtn.textContent = "예열 스캔";
    scanBtn.onclick = scanPreheatOrFallback;
  }
  const searchBtn = document.getElementById("search-btn") || document.querySelector("#search-btn");
  if (searchBtn) searchBtn.onclick = onSearch;
  const searchBox = document.getElementById("search") || document.querySelector("#search");
  if (searchBox) searchBox.addEventListener("keypress",(e)=>{ if(e.key==="Enter") onSearch(); });

  // 최초 로드
  await scanPreheatOrFallback();

  // 자동 갱신
  setInterval(scanPreheatOrFallback, AUTO_REFRESH_SEC*1000);
}

window.addEventListener("load", init);
