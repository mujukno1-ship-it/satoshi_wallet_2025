/* ===== 사토시의지갑 - 안정/개선 통합본 =====
   - 기존 컬럼 유지: 코인명/현재가/변동률/매수/매도/손절/위험도/예열시작시간/예열종류시간/쩔어결론
   - 업비트 서버리스 API 사용: /api/markets, /api/ticker
   - 업비트 KRW 호가단위 정확 반영(저가코인 포함)
   - 검색 정확도 향상(별칭 + 점수제) / 한글·영문·마켓코드 지원
   - 6~9초 지터 폴링 + 중복 fetch 취소 + 실패 시 직전 데이터 유지
*/
import { computeTargets } from "./targets-engine.js";
import { primaryAndTooltip } from "./targets-ui.js";   // (3번 파일 만들었다면)


const delay = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- 업비트 KRW 호가단위 ---------- */
function getTickKRW(p){
  if (p >= 2000000) return 1000;
  if (p >= 1000000) return 500;
  if (p >= 500000)  return 100;
  if (p >= 100000)  return 50;
  if (p >= 10000)   return 10;
  if (p >= 1000)    return 5;
  if (p >= 100)     return 1;
  if (p >= 10)      return 0.1;
  if (p >= 1)       return 0.01;
  if (p >= 0.1)     return 0.001;
  if (p >= 0.01)    return 0.0001;   // SHIB 구간 (소수 4자리)
  if (p >= 0.001)   return 0.00001;
  return 0.000001;
}
// mode: "nearest"(표시), "down"(매수), "up"(매도/목표)
function roundToTick(price, mode="nearest"){
  const t = getTickKRW(Math.abs(price));
  const q = price / t;
  let n = Math.round(q);
  if (mode === "down") n = Math.floor(q);
  if (mode === "up")   n = Math.ceil(q);
  const v = n * t;
  const dec = (t.toString().split(".")[1] || "").length;
  return Number(v.toFixed(dec));
}
// 자리수 고정(저가코인 0.0175 등 꼬박 유지)
function formatKRW(p){
  const t = getTickKRW(Math.abs(p));
  const dec = (t.toString().split(".")[1] || "").length;
  return Number(p).toFixed(dec);
}
const pct = (r)=> (r*100).toFixed(2) + "%";

/* ---------- 서버리스 API 호출 ---------- */
let inFlight; // AbortController
async function fetchJSON(url, tries=2){
  // 이전 요청 취소로 겹침 제거
  if (inFlight) inFlight.abort();
  inFlight = new AbortController();

  let err;
  for(let i=0;i<tries;i++){
    try{
      const r = await fetch(url, { signal: inFlight.signal, cache:"no-store" });
      if (!r.ok) throw new Error("HTTP "+r.status);
      return await r.json();
    }catch(e){
      if (e.name === "AbortError") throw e;
      err = e;
      await delay(500*(i+1));
    }
  }
  throw err;
}

async function loadMarkets(){
  const list = await fetchJSON("/api/markets");
  return list.filter(m => m.market && m.market.startsWith("KRW-"));
}
async function loadTicker(market){
  const data = await fetchJSON(`/api/ticker?market=${encodeURIComponent(market)}`);
  return Array.isArray(data) ? data[0] : data;
}

/* ---------- 검색 인덱스/별칭 ---------- */
const MC_KEY = "marketsCacheV1";
let marketsCache = [];
let idxByMarket = new Map();   // "krw-shib" -> obj
let idxByKo     = new Map();   // "시바이누" -> [obj]
let idxByEn     = new Map();   // "shibainu"/"shib" -> [obj]
const norm = (s)=> (s||"").toLowerCase().replace(/\s/g,"");

// 자주 쓰는 별칭은 확정 매핑
const ALIAS = new Map([
  ["시바", "KRW-SHIB"],
  ["시바이누", "KRW-SHIB"],
  ["shib", "KRW-SHIB"],
  ["shiba", "KRW-SHIB"],
  ["이더리움", "KRW-ETH"],
  ["eth", "KRW-ETH"],
  ["이더리움클래식", "KRW-ETC"],
  ["etc", "KRW-ETC"],
]);

function buildIndex(list){
  idxByMarket.clear(); idxByKo.clear(); idxByEn.clear();
  for(const m of list){
    const mk = norm(m.market);
    const kn = norm(m.korean_name);
    const en = norm(m.english_name);
    idxByMarket.set(mk, m);
    if (kn){ const a = idxByKo.get(kn)||[]; a.push(m); idxByKo.set(kn,a); }
    if (en){ const a = idxByEn.get(en)||[]; a.push(m); idxByEn.set(en,a); }
  }
}

async function loadMarketsCached(){
  const hit = localStorage.getItem(MC_KEY);
  if (hit){
    try{
      const cached = JSON.parse(hit);
      if (Array.isArray(cached) && cached.length){
        marketsCache = cached;
        buildIndex(marketsCache);
      }
    }catch{}
  }
  try{
    const live = await loadMarkets();
    marketsCache = live;
    buildIndex(marketsCache);
    localStorage.setItem(MC_KEY, JSON.stringify(live));
    console.log("✅ 업비트 마켓 불러오기 성공:", live.length);
  }catch(e){
    console.warn("⚠️ 마켓 목록 원격 로드 실패(캐시 사용):", e?.message||e);
    if (!marketsCache.length) throw e;
  }
}

/* 정확도 우선 매칭(별칭 > 정확일치 > 접미 > 포함(3자+)) */
function findMarketSmart(qRaw){
  const q = norm(qRaw);
  if (!q) return null;

  // 별칭
  const alias = ALIAS.get(q);
  if (alias){
    const hit = idxByMarket.get(norm(alias));
    if (hit) return hit;
  }

  // 정확 일치
  const mk = idxByMarket.get(q);
  if (mk) return mk;
  const ko = (idxByKo.get(q)||[])[0];
  if (ko) return ko;
  const en = (idxByEn.get(q)||[])[0];
  if (en) return en;

  // 마켓코드 endsWith (ex. "btc" -> "KRW-BTC")
  for (const [mkKey, obj] of idxByMarket){
    if (mkKey.endsWith(q)) return obj;
  }

  // 느슨 포함은 3자 이상부터
  if (q.length >= 3){
    let best=null, score=-1;
    for (const [k, arr] of idxByKo){
      if (k.includes(q)){
        const sc = 100 + (k===q?10:0) + (k.startsWith(q)?5:0);
        if (sc>score){ score=sc; best=arr[0]; }
      }
    }
    for (const [k, arr] of idxByEn){
      if (k.includes(q)){
        const sc = 90 + (k===q?10:0) + (k.startsWith(q)?5:0);
        if (sc>score){ score=sc; best=arr[0]; }
      }
    }
    for (const [k, obj] of idxByMarket){
      if (k.includes(q)){
        const sc = 80 + (k.endsWith(q)?3:0);
        if (sc>score){ score=sc; best=obj; }
      }
    }
    if (best) return best;
  }
  return null;
}

/* ---------- 리스크/의사결정/예열시간 ---------- */
function riskFromRate(r){
  const a=Math.abs(r);
  return a>=0.05?3:a>=0.02?2:1;
}
function decisionFromRate(r){
  if(r>=0.05) return "익절 분할 / 추격주의";
  if(r>=0.02) return "눌림 매수 후보";
  if(r<=-0.02) return "저점 분할대기";
  return "관망";
}
function buyPrice(p, r){
  if (r>=0.05) return ""; // 급등 구간 추격 금지
  const target = r>=0.02 ? p*0.995 : r<=-0.02 ? p*0.985 : p*0.998;
  return formatKRW(roundToTick(target, "down"));
}
function takeProfit(p, r){
  const target = r>=0.05 ? p*1.05 : r>=0.02 ? p*1.03 : p*1.02;
  return formatKRW(roundToTick(target, "up"));
}
function stopLoss(p, r){
  const target = r>=0.05 ? p*0.97 : r>=0.02 ? p*0.98 : p*0.985;
  return formatKRW(roundToTick(target, "down"));
}
const fmtTime = (ms)=> ms ? new Date(ms).toLocaleTimeString("ko-KR",{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : "—";
const warmState = {}; // 예열 2~5% 구간 추적
function updateWarmTimes(code, rNow){
  const s = warmState[code] || { startedAt:null, endedAt:null, inWarm:false };
  const nowWarm = (rNow>=0.02 && rNow<0.05);
  if (nowWarm && !s.inWarm){ s.startedAt=Date.now(); s.endedAt=null; }
  else if (!nowWarm && s.inWarm){ s.endedAt=Date.now(); }
  s.inWarm = nowWarm;
  warmState[code] = s;
  return s;
}

/* ---------- 렌더링/폴링 ---------- */
let pollTimer=null;
let lastRowHTML="";

function renderEmpty(msg){
  const tb = document.getElementById("result-body");
  if (!tb) return;
  tb.innerHTML = `<tr><td colspan="10" class="empty">${msg}</td></tr>`;
}

function startPolling(hit){
  if (pollTimer) clearTimeout(pollTimer);
  const tick = 6000 + Math.floor(Math.random()*3000); // 6~9초 지터
  pollTimer = setTimeout(async ()=>{
    await renderRowSafe(hit);
    startPolling(hit);
  }, tick);
}

async function renderRowSafe(hit){
  const tb = document.getElementById("result-body");
  if (!tb) return;
  try{
    const tk   = await loadTicker(hit.market);
    const rate = tk.signed_change_rate ?? 0;
    const p    = tk.trade_price ?? 0;


// === 풀세트 무한확장 타점 계산 ===
const targets = computeTargets({
  market: hit.market,
  price: p,
  rate,
  now: new Date(), // 한국시간 기준 자동 반영
});
const buyInfo  = primaryAndTooltip(targets.buy);
const takeInfo = primaryAndTooltip(targets.take);
const stopInfo = primaryAndTooltip(targets.stop);
// =================================

    const warm   = updateWarmTimes(tk.code || hit.market, rate);
    const risk   = riskFromRate(rate);
    const decide = decisionFromRate(rate);

    // 변화 없으면 렌더 스킵(깜빡임 제거)
    const key = `${p}|${rate}`;
    if (renderRowSafe._key === key && lastRowHTML){
      tb.innerHTML = lastRowHTML;
      return;
    }
    renderRowSafe._key = key;

    const row = `
      <tr>
        <td class="nowrap">${hit.korean_name} (${hit.market})</td>
        <td class="price ${tk.change==='RISE'?'up':(tk.change==='FALL'?'down':'')}">${formatKRW(roundToTick(p))}</td>
        <td>${pct(rate)}</td>
        <td>${buyPrice(p, rate)}</td>
        <td>${takeProfit(p, rate)}</td>
        <td>${stopLoss(p, rate)}</td>
        <td>${risk}</td>
        <td>${fmtTime(warm.startedAt)}</td>
        <td>${fmtTime(warm.endedAt)}</td>
        <td>${decide}</td>
      </tr>`;
    tb.innerHTML = row;
    lastRowHTML  = row;
  }catch(e){
    // 실패 시 이전 데이터 유지
    if (lastRowHTML) tb.innerHTML = lastRowHTML;
    else renderEmpty("서버 응답 대기 중…");
  }
}

/* ---------- 초기화/검색 ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    await loadMarketsCached();
  }catch(e){
    console.error("❌ 마켓 로드 실패:", e);
    renderEmpty("마켓 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  const input = document.getElementById("search-input");
  const btn   = document.getElementById("search-btn");
  if (btn) btn.addEventListener("click", onSearch);
  if (input) input.addEventListener("keydown", (e)=>{ if(e.key==="Enter") onSearch(); });
});

async function onSearch(){
  const input = document.getElementById("search-input");
  const q = (input?.value || "").trim();
  if (!q) return;

  const hit = findMarketSmart(q);
  if (!hit){ renderEmpty("검색 결과 없음"); if (pollTimer) clearTimeout(pollTimer); return; }

  if (pollTimer) clearTimeout(pollTimer);
  await renderRowSafe(hit);   // 즉시 1회
  startPolling(hit);          // 이후 주기 갱신
}
