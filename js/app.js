/* ===== 사토시의지갑 : 안정/개선 통합본 =====
 * - 기존 기능 유지 : 코인명/심볼 검색 + 매수/매도/손절/위험도/예열(시작/종류)/결론
 * - 업비트 서버리스 API 사용 : /api/markets , /api/ticker
 * - 400/429 완화 : URLSearchParams + 50개 청크 + 순차요청 + 9~12s 랜덤 폴링
 * - 검색/표 렌더 성능 향상 & 실패시 이전 데이터 유지
 */

import computeTargets from "./targets-engine.js";
import { primaryAndTooltip } from "./targets-ui.js";
import cfg from "./targets-config.js";

/* ---------- 유틸 ---------- */
const API_MARKETS = "/api/markets";
const API_TICKER  = "/api/ticker"; // GET /api/ticker?markets=a,b,c  또는 ?market=KRW-xxx

let inflight; // AbortController (중복요청 취소)
let pollTimer; // 실시간 상승 폴링 타이머
let marketsCache = null; // KRW 마켓 목록 캐시
let lastRowHTML = "";

/* 가격 포맷 (KRW, 2자리 고정 + 저가코인 보정) */
function getTickKRW(p){
  if (p >= 2_000_000) return 100;
  if (p >=   100_000) return 500;
  if (p >=    10_000) return 100;
  if (p >=     1_000) return  50;
  if (p >=       100) return   1;
  if (p >=        10) return 0.1;
  return 0.01;
}
function roundToTick(p){
  const t = getTickKRW(Math.abs(p));
  return Math.round(p / t) * t;
}
function formatKRW(p){
  try{
    const dec = (p.toString().split(".")[1] ?? "").length;
    return new Intl.NumberFormat("ko-KR").format(
      roundToTick(p) + (dec ? 0 : 0) // 보정
    );
  }catch(e){ return String(p ?? 0); }
}
function pct(r){ return (r*100).toFixed(2) + "%"; }

/* ---------- 공통 fetch (취소/재시도) ---------- */
async function fetchJSON(url, tries=2){
  // 이전 요청 취소
  if (inflight) inflight.abort();
  inflight = new AbortController();

  let lastErr;
  for (let i=0;i<tries;i++){
    try{
      const r = await fetch(url, { signal: inflight.signal, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP "+r.status);
      return await r.json();
    }catch(e){
      lastErr = e;
      // 429 는 잠깐 쉬고 재시도
      await delay(500 + i*300);
    }
  }
  throw lastErr;
}
const delay = (ms)=> new Promise(res=> setTimeout(res, ms));

/* ---------- 마켓 목록 (KRW) ---------- */
async function loadMarketsCached(){
  if (marketsCache) return marketsCache;

  const list = await fetchJSON(API_MARKETS);
  // 서버가 주는 필드: market, korean_name, english_name
  marketsCache = list
    .filter(m => /^KRW-[A-Z0-9]+$/.test(m.market))
    .map(m => ({ market:m.market, korean_name:m.korean_name, english_name:m.english_name }));
  console.log("✅ 업비트 마켓 불러오기 성공 :", marketsCache.length);
  return marketsCache;
}

/* ---------- 개별 티커 ---------- */
async function loadTicker(market){
  // 단건 호환: /api/ticker?market=KRW-XXX (서버쪽에서 배열/단건 모두 허용)
  const qs = new URLSearchParams({ market });
  const d  = await fetchJSON(`${API_TICKER}?${qs.toString()}`);
  // 서버 구현에 따라 객체/배열이 올 수 있으니 보정
  return Array.isArray(d) ? d[0] : d;
}

/* ---------- 배치 티커 (안정/개선 버전) ---------- */
async function fetchTickers(markets = []){
  // 1) 입력을 문자열/객체배열 모두 허용 + 정규식 필터 + 중복 제거
  const all = (Array.isArray(markets) ? markets : [])
    .map(m => (m && m.market ? String(m.market).trim() : String(m).trim()))
    .filter(Boolean)
    .filter(s => /^KRW-[A-Z0-9]+$/.test(s));

  const uniq = Array.from(new Set(all));
  if (uniq.length === 0) return [];

  // 2) 50개 단위 청크로 분할 (429/URI 길이 방지)
  const CHUNK = 50;
  const out = [];
  for (let i=0; i<uniq.length; i+=CHUNK){
    const chunkArr = uniq.slice(i, i+CHUNK);
    if (chunkArr.length === 0) continue;

    // URLSearchParams 로 안전하게 쿼리 구성
    const qs = new URLSearchParams({ markets: chunkArr.join(",") }).toString();
    try{
      const r = await fetch(`${API_TICKER}?${qs}`, { cache: "no-store" });
      if (!r.ok){ console.warn("⚠ API 응답 실패:", r.status); continue; }
      const d = await r.json();
      if (Array.isArray(d)) out.push(...d);
      else console.warn("⚠ ticker 응답 형식 이상:", d);
    }catch(e){
      console.error("fetchTickers 오류:", e);
    }

    // 청크 사이 간격(120~220ms 랜덤) — 429 완화
    await delay(120 + Math.floor(Math.random()*100));
  }

  return out
    .filter(t => typeof t.signed_change_rate === "number") // 안전
    .sort((a,b) => b.signed_change_rate - a.signed_change_rate); // 높은 변동률 우선
}

/* ---------- 실시간 상승(Top 9) 렌더 ---------- */
function renderSpikes(list = []){
  const box = document.getElementById("spike-box");
  if (!box) return;

  if (list.length === 0){
    box.innerHTML = `<div class="title">실시간 상승</div><div class="muted">데이터 없음</div>`;
    return;
  }

  const html = `
    <div class="title">실시간 상승</div>
    <div class="spike-list" id="spike-list">
      ${list.map(t => {
        const name = `${t.korean_name ?? ""} (${t.market})`;
        const p    = formatKRW(t.trade_price ?? 0);
        const rate = t.signed_change_rate ?? 0;
        const cls  = rate >= 0 ? "up" : "down";
        return `
          <div class="spike">
            <span class="n">${name}</span>
            <span class="p">${p}</span>
            <span class="r ${cls}">${pct(rate)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
  box.innerHTML = html;
}

/* ---------- 검색 결과 박스 ---------- */
function renderEmpty(msg){
  const tb = document.getElementById("result-body");
  if (!tb) return;
  tb.innerHTML = `<tr><td colspan="10" class="empty">${msg}</td></tr>`;
}

/* ---------- 검색 결과 1행 렌더(기존 계산 로직 유지) ---------- */
async function renderRowSafe(hit){
  const tb = document.getElementById("result-body");
  if (!tb) return;
  try{
    const tk   = await loadTicker(hit.market);
    const rate = tk.signed_change_rate ?? 0;
    const p    = tk.trade_price ?? 0;

    // === 기존 타점 계산 (모듈 그대로 활용) ===
    const targets = computeTargets({
      market: hit.market,
      price:  p,
      rate,
      now: new Date(),
    });

    const buyInfo  = primaryAndTooltip(targets.buy);
    const takeInfo = primaryAndTooltip(targets.take);
    const stopInfo = primaryAndTooltip(targets.stop);

    // 위험/결정
    const warm   = updateWarnTimes(tk.code || hit.market, rate);
    const risk   = riskFromRate(rate);
    const decide = decisionFromRate(rate);

    const riskClass = `risk-${Math.min(5, Math.max(1, risk))}`;
    const riskTitle = (r => (
      r>=5 ? "🚨 매우 위험 (급변동)" :
      r>=4 ? "⚠ 위험 (변동성 큼)" :
      r>=3 ? "주의 (예열/가속)" :
      r>=2 ? "보통 (완만/소량)" :
             "안전 (관망)"
    ))(risk);

    const row = `
      <tr>
        <td class="nowrap">${hit.korean_name ?? ""} (${hit.market})</td>
        <td class="price ${rate>=0?'up':'down'}">${formatKRW(roundToTick(p))}</td>
        <td>${pct(rate)}</td>
        <td>${buyInfo}</td>
        <td>${takeInfo}</td>
        <td>${stopInfo}</td>
        <td><span class="risk-badge ${riskClass}" title="${riskTitle}">${risk}</span></td>
        <td>${fmtTime(warm.startedAt)}</td>
        <td>${fmtTime(warm.endedAt)}</td>
        <td>${decide}</td>
      </tr>
    `;

    tb.innerHTML = row;
    lastRowHTML  = row;
  }catch(e){
    console.error("renderRowSafe 오류:", e);
    // 실패 시 이전 데이터 유지
    if (lastRowHTML) tb.innerHTML = lastRowHTML;
    else renderEmpty("서버 응답 대기 중…");
  }
}

/* === 아래 3개는 기존 파일에 있던 보조 로직과 동일 동작을 위한 얇은 래퍼 === */
function updateWarnTimes(code, rate){ return cfg.updateWarnTimes ? cfg.updateWarnTimes(code, rate) : { startedAt:null, endedAt:null }; }
function riskFromRate(rate){ return cfg.riskFromRate ? cfg.riskFromRate(rate) : (rate>0.05?5:rate>0.03?4:rate>0.015?3:rate>0?2:1); }
function decisionFromRate(rate){ return cfg.decisionFromRate ? cfg.decisionFromRate(rate) : (rate>0.03?"관망":"관망"); }
function fmtTime(t){ if(!t) return "—"; try{ const d = new Date(t); return d.toLocaleTimeString("ko-KR",{hour12:false}); }catch(_){return "—"} }

/* ---------- 검색 동작 ---------- */
function findMarketSmart(q){
  q = (q ?? "").trim();
  if (!q) return null;
  const L = q.toLowerCase();

  // 정확도 높은 순서대로 탐색
  // 1) 정확히 market 입력한 경우
  let hit = marketsCache.find(m => m.market.toLowerCase() === L);
  if (hit) return hit;

  // 2) 심볼만 입력한 경우 (BTC → KRW-BTC)
  hit = marketsCache.find(m => m.market.toLowerCase().endsWith("-"+L));
  if (hit) return hit;

  // 3) 한글명 포함
  hit = marketsCache.find(m => (m.korean_name ?? "").toLowerCase().includes(L));
  if (hit) return hit;

  // 4) 영문명 포함
  hit = marketsCache.find(m => (m.english_name ?? "").toLowerCase().includes(L));
  return hit || null;
}

async function onSearch(){
  const input = document.getElementById("search-input");
  const q = (input?.value ?? "").trim();
  if (!q) return;

  const hit = findMarketSmart(q);
  if (!hit){ renderEmpty("검색 결과 없음"); if (pollTimer) clearTimeout(pollTimer); return; }

  if (pollTimer) clearTimeout(pollTimer);
  await renderRowSafe(hit); // 즉시 1회
  startPolling(hit);        // 이후 주기
}

/* ---------- 검색 폴링 ---------- */
function startPolling(hit){
  if (pollTimer) clearTimeout(pollTimer);
  const tick = 6000 + Math.floor(Math.random()*3000); // 6~9초
  pollTimer = setTimeout(async ()=>{
    await renderRowSafe(hit);
    startPolling(hit);
  }, tick);
}

/* ---------- 실시간 상승 9종 폴링 ---------- */
async function pollSpikes(){
  try{
    const mkts = await loadMarketsCached();
    const ticks = await fetchTickers(mkts);

    // 이름 매핑 (표시용)
    const nameMap = Object.fromEntries(mkts.map(m => [m.market, m]));
    ticks.forEach(t => Object.assign(t, nameMap[t.market] || {}));

    const top = ticks.slice(0, 9);
    renderSpikes(top);
  }catch(e){
    console.error("pollSpikes error:", e);
  }finally{
    // 9~12초 랜덤 — 429 완화
    const next = 9000 + Math.floor(Math.random()*3000);
    setTimeout(pollSpikes, next);
  }
}

/* ---------- 초기화 ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    await loadMarketsCached();
  }catch(e){
    console.error("❌ 마켓 로드 실패:", e);
    renderEmpty("마켓 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  }

  const input = document.getElementById("search-input");
  const btn   = document.getElementById("search-btn");
  if (btn)   btn.addEventListener("click", onSearch);
  if (input) input.addEventListener("keydown", (e)=>{ if(e.key==="Enter") onSearch(); });

  // 실시간 상승 9종 자동 갱신 시작
  pollSpikes();

  console.log("✅ app.js 로드 완료");
});
