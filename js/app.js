// ====== 설정 & 유틸 ======
const PROXY = "https://api.allorigins.win/raw?url="; // CORS 프록시
const UPBIT = "https://api.upbit.com";
const delay  = (ms)=>new Promise(r=>setTimeout(r,ms));
const toKRW  = (n)=>new Intl.NumberFormat("ko-KR").format(n);
const fmtTime = (d)=> d ? new Date(d).toLocaleTimeString("ko-KR",{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : "—";

async function getJSON(url, tries=3){
  let err;
  for(let i=0;i<tries;i++){
    try{
      const r = await fetch(url, { cache:"no-store" });
      if(!r.ok) throw new Error("HTTP "+r.status);
      return await r.json();
    }catch(e){ err=e; await delay(400*(i+1)); }
  }
  throw err;
}

// ====== 데이터 로더 ======
async function loadMarkets(){
  const url = `${PROXY}${encodeURIComponent(`${UPBIT}/v1/market/all?isDetails=false`)}`;
  const res = await getJSON(url);
  return res.filter(m=>m.market.startsWith("KRW-"));
}
async function loadTicker(market){
  const url = `${PROXY}${encodeURIComponent(`${UPBIT}/v1/ticker?markets=${market}`)}`;
  const res = await getJSON(url);
  return Array.isArray(res) ? res[0] : res;
}

// ====== 상태 ======
let marketsCache = null;
let pollTimer = null;
// 예열 시작/종료 시간 추적용 (세션 메모리)
const warmState = {}; // { "KRW-BTC": {startedAt: ms|null, endedAt: ms|null, inWarm: bool } }

// ====== 초기화 ======
document.addEventListener("DOMContentLoaded", async ()=>{
  marketsCache = await loadMarkets();
  document.getElementById("search-btn").addEventListener("click", onSearch);
  document.getElementById("search-input").addEventListener("keydown", (e)=>{ if(e.key==="Enter") onSearch(); });
});

// ====== 검색 로직 ======
function findMarket(q){
  const s = q.toLowerCase().replace(/\s/g,"");
  return marketsCache.find(m =>
    m.market.toLowerCase() === s ||
    (m.korean_name||"").replace(/\s/g,"").includes(s) ||
    (m.english_name||"").toLowerCase().includes(s)
  ) || marketsCache.find(m => m.market.toLowerCase().endsWith(s));
}

async function onSearch(){
  const q = document.getElementById("search-input").value.trim();
  if(!q) return;
  const hit = findMarket(q);
  if(!hit){ return renderEmpty("검색 결과 없음"); }

  if (pollTimer) clearInterval(pollTimer);
  await renderRow(hit);                      // 즉시 1회
pollTimer = setInterval(()=>renderRowSafe(hit), 5000);
}

// ====== 렌더 & 규칙 ======
// 간단 규칙(현금 분할 기준)
// - 상태: 급등(>=+5%), 예열(+2~+5%), 가열(<=-2%), 중립(그외)
// - 매수: 예열이면 현재가의 -0.5% 눌림가, 급등은 추격주의(매수 공백)
// - 매도: 상태별 목표가(예열 +3%, 급등 +5%, 가열/중립 +2%)
// - 손절: 상태별 손절가(예열 -2%, 급등 -3%, 가열/중립 -1.5%)
// - 위험도: 1(저)~3(고) : |변동률| 기준 맵핑
function statusFromRate(r){ if(r>=0.05) return "급등"; if(r>=0.02) return "예열"; if(r<=-0.02) return "가열"; return "중립"; }
function riskFromRate(r){ const a=Math.abs(r); return a>=0.05?3:a>=0.02?2:1; }
function decisionFromRate(r){
  if(r>=0.05) return "익절 분할 / 추격주의";
  if(r>=0.02) return "눌림 매수 후보";
  if(r<=-0.02) return "저점 분할대기";
  return "관망";
}

function buyPrice(price, r){ // 매수 제안가
  if(r>=0.05) return ""; // 급등 추격 금지
  if(r>=0.02) return toKRW(price*0.995); // -0.5%
  if(r<=-0.02) return toKRW(price*0.985); // 하락 중 분할 진입
  return toKRW(price*0.998); // 소액 체크
}
function takeProfit(price, r){ // 매도가
  if(r>=0.05) return toKRW(price*1.05);
  if(r>=0.02) return toKRW(price*1.03);
  if(r<=-0.02) return toKRW(price*1.02);
  return toKRW(price*1.02);
}
function stopLoss(price, r){ // 손절가
  if(r>=0.05) return toKRW(price*0.97);
  if(r>=0.02) return toKRW(price*0.98);
  if(r<=-0.02) return toKRW(price*0.985);
  return toKRW(price*0.985);
}

function updateWarmTimes(code, rNow){
  const s = warmState[code] || { startedAt:null, endedAt:null, inWarm:false };
  const inWarmNow = (rNow>=0.02 && rNow<0.05);
  if (inWarmNow && !s.inWarm){ // 진입
    s.startedAt = Date.now();
    s.endedAt = null;
  } else if (!inWarmNow && s.inWarm){ // 이탈
    s.endedAt = Date.now();
  }
  s.inWarm = inWarmNow;
  warmState[code] = s;
  return s;
}

async function renderRow(hit){
  try{
    const tk = await loadTicker(hit.market);
    const rate = tk.signed_change_rate || 0;            // -0.0123 → -1.23%
    const price = tk.trade_price || 0;

    // 예열 시간 추적
    const warm = updateWarmTimes(tk.code || hit.market, rate);

    const status = statusFromRate(rate);
    const risk   = riskFromRate(rate);
    const decision = decisionFromRate(rate);

    const row = `
      <tr>
        <td class="nowrap">${hit.korean_name} (${hit.market})</td>
        <td class="price ${tk.change==='RISE'?'up':(tk.change==='FALL'?'down':'')}">${toKRW(price)}</td>
        <td>${(rate*100).toFixed(2)}%</td>
        <td>${buyPrice(price, rate)}</td>
        <td>${takeProfit(price, rate)}</td>
        <td>${stopLoss(price, rate)}</td>
        <td>${risk}</td>
        <td>${fmtTime(warm.startedAt)}</td>
        <td>${fmtTime(warm.endedAt)}</td>
        <td>${decision}</td>
      </tr>`;
    document.getElementById("result-body").innerHTML = row;
  }catch(e){
    renderEmpty("데이터 불러오기 실패… 재시도 중");
  }
}

function renderEmpty(msg){
  const tb = document.getElementById("result-body");
  if (!tb) return;
  tb.innerHTML = `<tr><td colspan="10" class="empty">${msg}</td></tr>`;
}
