/* ===== 사토시의지갑 - 검색 전용 통합본 =====
   유지 기능:
   - 코인 검색(한글/영문/마켓코드)
   - 현재가/변동률/매수/매도/손절/위험도/예열시작/예열종류/쩔어결론 표시
   - 5초 간격 자동 갱신 (429 완화)
   - 네트워크 실패 시 직전 데이터 유지(깜박임 NO)
   - 예열(2~5%) 구간 진입/이탈 시각 추적
   - 업비트 KRW 호가단위/소수점 정확 적용(저가코인 포함)
*/

const PROXY = "https://corsproxy.io/?";
const UPBIT  = "https://api.upbit.com";
const delay  = (ms) => new Promise(r => setTimeout(r, ms));

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
  if (p >= 0.01)    return 0.0001;
  if (p >= 0.001)   return 0.00001;
  return 0.000001;
}

function roundToTick(price){
  const t = getTickKRW(Math.abs(price));
  const q = Math.round(price / t);
  const rounded = q * t;
  const dec = (t.toString().split(".")[1] || "").length;
  return Number(rounded.toFixed(dec));
}

function formatKRW(price){
  const t = getTickKRW(Math.abs(price));
  const dec = (t.toString().split(".")[1] || "").length;
  return price.toFixed(dec);
}

const toKRW = (n)=> new Intl.NumberFormat("ko-KR").format(n); // 필요시 사용

/* ---------- 네트워크 ---------- */
async function getJSON(url, tries=3){
  let err;
  for (let i=0;i<tries;i++){
    try{
      const r = await fetch(url, { cache:"no-store" });
      if(!r.ok) throw new Error("HTTP "+r.status);
      return await r.json();
    }catch(e){ err=e; await delay(500*(i+1)); }
  }
  throw err;
}
async function loadMarkets(){
  const url = `${PROXY}${encodeURIComponent(`${UPBIT}/v1/market/all?isDetails=false`)}`;
  const list = await getJSON(url);
  return list.filter(m => m.market.startsWith("KRW-"));
}
async function loadTicker(market){
  const url = `${PROXY}${encodeURIComponent(`${UPBIT}/v1/ticker?markets=${market}`)}`;
  const res = await getJSON(url);
  return Array.isArray(res) ? res[0] : res;
}

/* ---------- 상태/규칙 ---------- */
let marketsCache = null;
let pollTimer = null;
let lastRowHTML = "";              // 마지막 정상 렌더 저장(깜박임 방지)
const warmState = {};              // 예열 상태 추적

function statusFromRate(r){ if(r>=0.05) return "급등"; if(r>=0.02) return "예열"; if(r<=-0.02) return "가열"; return "중립"; }
function riskFromRate(r){ const a=Math.abs(r); return a>=0.05?3:a>=0.02?2:1; }
function decisionFromRate(r){
  if(r>=0.05) return "익절 분할 / 추격주의";
  if(r>=0.02) return "눌림 매수 후보";
  if(r<=-0.02) return "저점 분할대기";
  return "관망";
}
function buyPrice(p, r){
  if(r>=0.05) return ""; // 급등 추격 금지
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
function updateWarmTimes(code, rNow){
  const s = warmState[code] || { startedAt:null, endedAt:null, inWarm:false };
  const inWarmNow = (rNow>=0.02 && rNow<0.05);
  if (inWarmNow && !s.inWarm){ s.startedAt = Date.now(); s.endedAt = null; }
  else if (!inWarmNow && s.inWarm){ s.endedAt = Date.now(); }
  s.inWarm = inWarmNow;
  warmState[code] = s;
  return s;
}

/* ---------- 초기화 ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  marketsCache = await loadMarkets();

  document.getElementById("search-btn").addEventListener("click", onSearch);
  document.getElementById("search-input").addEventListener("keydown",(e)=>{ if(e.key==="Enter") onSearch(); });
});

function findMarket(q){
  const s = q.toLowerCase().replace(/\s/g,"");
  return marketsCache.find(m =>
    m.market.toLowerCase() === s ||
    (m.korean_name||"").replace(/\s/g,"").includes(s) ||
    (m.english_name||"").toLowerCase().includes(s)
  ) || marketsCache.find(m => m.market.toLowerCase().endsWith(s));
}

/* ---------- 렌더 ---------- */
function renderEmpty(msg){
  const tb = document.getElementById("result-body");
  if (!tb) return;
  tb.innerHTML = `<tr><td colspan="10" class="empty">${msg}</td></tr>`;
}

async function onSearch(){
  const q = document.getElementById("search-input").value.trim();
  if(!q) return;

  const hit = findMarket(q);
  if(!hit){ renderEmpty("검색 결과 없음"); if(pollTimer) clearInterval(pollTimer); return; }

  if (pollTimer) clearInterval(pollTimer);
  await renderRowSafe(hit);                      // 즉시 1회
  pollTimer = setInterval(()=>renderRowSafe(hit), 5000); // 5초 주기
}

async function renderRowSafe(hit){
  try{
    const tk    = await loadTicker(hit.market);
    const rate  = tk.signed_change_rate || 0;
    const price = tk.trade_price || 0;

    const warm      = updateWarmTimes(tk.code || hit.market, rate);
    const status    = statusFromRate(rate);
    const risk      = riskFromRate(rate);
    const decision  = decisionFromRate(rate);

    const row = `
      <tr>
        <td class="nowrap">${hit.korean_name} (${hit.market})</td>
        <td class="price ${tk.change==='RISE'?'up':(tk.change==='FALL'?'down':'')}">${formatKRW(roundToTick(price))}</td>
        <td>${(rate*100).toFixed(2)}%</td>
        <td>${buyPrice(price, rate)}</td>
        <td>${takeProfit(price, rate)}</td>
        <td>${stopLoss(price, rate)}</td>
        <td>${risk}</td>
        <td>${fmtTime(warm.startedAt)}</td>
        <td>${fmtTime(warm.endedAt)}</td>
        <td>${decision}</td>
      </tr>`;

    const tb = document.getElementById("result-body");
    if (!tb) return;
    tb.innerHTML = row;
    lastRowHTML = row; // 정상 데이터 저장
  }catch(e){
    // 실패 시 이전 데이터 유지 (깜빡임 방지)
    const tb = document.getElementById("result-body");
    if (!tb) return;
    if (lastRowHTML) tb.innerHTML = lastRowHTML;
    else renderEmpty("서버 응답 대기 중…");
  }
}
