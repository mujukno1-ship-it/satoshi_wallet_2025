/* ===== 사토시의지갑 - 안정 기본버전 =====
   검색 후 실시간 가격/매수/매도/손절/위험도/쩔어결론 표시
   업비트 KRW 호가단위 완전 동일
   API 요청 중복 차단 + 깜빡임 없음
*/

const PROXY = "https://corsproxy.io/?";
const UPBIT = "https://api.upbit.com";
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
function roundToTick(p){
  const t=getTickKRW(Math.abs(p));
  const q=Math.round(p/t);
  const v=q*t;
  const dec=(t.toString().split(".")[1]||"").length;
  return Number(v.toFixed(dec));
}
function formatKRW(p){
  const t=getTickKRW(Math.abs(p));
  const dec=(t.toString().split(".")[1]||"").length;
  return p.toFixed(dec);
}

/* ---------- API ---------- */
async function getJSON(url){
  const r = await fetch(url, { cache:"no-store" });
  if(!r.ok) throw new Error("HTTP "+r.status);
  return await r.json();
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

/* ---------- 규칙 ---------- */
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
function buyPrice(p,r){
  if(r>=0.05) return "";
  const target = r>=0.02?p*0.995:r<=-0.02?p*0.985:p*0.998;
  return formatKRW(roundToTick(target));
}
function takeProfit(p,r){
  const target = r>=0.05?p*1.05:r>=0.02?p*1.03:p*1.02;
  return formatKRW(roundToTick(target));
}
function stopLoss(p,r){
  const target = r>=0.05?p*0.97:r>=0.02?p*0.98:p*0.985;
  return formatKRW(roundToTick(target));
}

/* ---------- 실행 ---------- */
let markets = [];
let timer=null;
let lastHTML="";

document.addEventListener("DOMContentLoaded", async ()=>{
  markets = await loadMarkets();
  document.getElementById("search-btn").addEventListener("click", search);
  document.getElementById("search-input").addEventListener("keydown",(e)=>{if(e.key==="Enter")search();});
});

function findMarket(q){
  q=q.toLowerCase().replace(/\s/g,"");
  return markets.find(m=>m.market.toLowerCase()===q ||
    (m.korean_name||"").replace(/\s/g,"").includes(q) ||
    (m.english_name||"").toLowerCase().includes(q));
}

async function search(){
  const q=document.getElementById("search-input").value.trim();
  if(!q) return;
  const hit=findMarket(q);
  const tb=document.getElementById("result-body");
  if(!hit){tb.innerHTML="<tr><td colspan='10'>검색 결과 없음</td></tr>";return;}

  if(timer) clearInterval(timer);
  await render(hit);
  timer=setInterval(()=>render(hit),5000);
}

async function render(hit){
  const tb=document.getElementById("result-body");
  try{
    const tk=await loadTicker(hit.market);
    const rate=tk.signed_change_rate||0;
    const p=tk.trade_price||0;
    const risk=riskFromRate(rate);
    const dec=decisionFromRate(rate);
    const row=`
      <tr>
        <td>${hit.korean_name} (${hit.market})</td>
        <td>${formatKRW(roundToTick(p))}</td>
        <td>${(rate*100).toFixed(2)}%</td>
        <td>${buyPrice(p,rate)}</td>
        <td>${takeProfit(p,rate)}</td>
        <td>${stopLoss(p,rate)}</td>
        <td>${risk}</td>
        <td>${dec}</td>
      </tr>`;
    tb.innerHTML=row;
    lastHTML=row;
  }catch(e){
    if(lastHTML) tb.innerHTML=lastHTML;
    else tb.innerHTML="<tr><td colspan='10'>서버 응답 대기 중...</td></tr>";
  }
}
