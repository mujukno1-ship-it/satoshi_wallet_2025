// /js/main.js
import { getKRWMarkets, getTickers, ping } from "../integrations/upbit/public.js";

const POLL_MS = 1000;
const SPIKE_WINDOW_SEC = 60;
const SPIKE_UP_PCT = 0.7, SPIKE_DOWN_PCT = -0.7;
const PREHEAT_MIN_24H = 3, PREHEAT_MAX_24H = 8, OVERHEAT_MIN_24H = 8;
const LIST_LIMIT = 5;

const $search = document.querySelector("#searchInput");
const $btn = document.querySelector("#searchBtn");
const $tbody = document.querySelector("#coinsTbody");
const $loadingRow = document.querySelector("#loadingRow");
const $conn = document.querySelector("#connStatus");

const $spikeUp = document.querySelector("#spikeUpList");
const $spikeDown = document.querySelector("#spikeDownList");
const $preheat = document.querySelector("#preheatList");
const $overheat = document.querySelector("#overheatList");
const $btnScanPreheat = document.querySelector("#btnScanPreheat");

let ALL_MARKETS = [];
let CURRENT_VIEW = ["KRW-BTC"];
let POLL_TIMER = null;
let HEART_TIMER = null;
let MARKETS_TIMER = null;

let FAILS = 0;
const FAIL_LIMIT = 5;

let lastTickAt = 0;
let LAST_OK_TICKERS = [];
let LAST_OK_AT = 0;

const LAST_SEEN = new Map();

function setConnStatus(t, color = "#16a34a") {
  if (!$conn) return;
  $conn.textContent = t;
  $conn.style.color = color;
}
const fmt = (n,d=2)=>{
  const v = Number(n);
  if (!isFinite(v)) return "-";
  if (v >= 1_000_000) return v.toLocaleString("ko-KR",{maximumFractionDigits:0});
  if (v >= 1_000)    return v.toLocaleString("ko-KR",{maximumFractionDigits:0});
  return v.toLocaleString("ko-KR",{maximumFractionDigits:d});
};
function calcEntryExit(p){ const price = Number(p)||0;
  return { buy1:Math.round(price*0.996*100)/100, sell1:Math.round(price*1.004*100)/100, state:"대기" };
}
function rowHTML(t, stale=false){
  const name = t.market.replace("KRW-","");
  const {buy1,sell1,state} = calcEntryExit(t.trade_price);
  const staleMark = stale ? ' style="opacity:0.6"' : "";
  return `<tr${staleMark}><td>${name}</td><td>${fmt(t.trade_price)}</td><td>${fmt(buy1)}</td><td>${fmt(sell1)}</td><td>${state}</td></tr>`;
}
function renderTable(tickers,{stale=false}={}) {
  if ($loadingRow) $loadingRow.style.display = "none";
  if (!tickers?.length) { $tbody.innerHTML = `<tr><td colspan="5">데이터 없음</td></tr>`; return; }
  $tbody.innerHTML = tickers.map(t => rowHTML(t, stale)).join("");
}

function calcSpike(t){
  const now=Date.now(), prev=LAST_SEEN.get(t.market);
  if(!prev){ LAST_SEEN.set(t.market,{price:t.trade_price,time:now}); return null; }
  const dt=(now-prev.time)/1000;
  if(dt<=SPIKE_WINDOW_SEC){
    return ((t.trade_price - prev.price)/prev.price)*100;
  }
  LAST_SEEN.set(t.market,{price:t.trade_price,time:now}); return null;
}
function setList($ul, items){
  if(!$ul) return;
  if(!items?.length){ $ul.innerHTML=`<li class="muted">항목 없음</li>`; return; }
  $ul.innerHTML = items.slice(0,LIST_LIMIT)
    .map(it=>`<li>${it.label}<span style="float:right;">${it.value}</span></li>`).join("");
}
function updateSignals(tickers){
  if(!tickers?.length) return;
  const up=[], down=[];
  for(const t of tickers){
    const pct=calcSpike(t); LAST_SEEN.set(t.market,{price:t.trade_price,time:Date.now()});
    if(pct==null||!isFinite(pct)) continue;
    const label=t.market.replace("KRW-","");
    if(pct>=SPIKE_UP_PCT) up.push({label,value:`+${pct.toFixed(2)}%`});
    if(pct<=SPIKE_DOWN_PCT) down.push({label,value:`${pct.toFixed(2)}%`});
  }
  up.sort((a,b)=>parseFloat(b.value)-parseFloat(a.value));
  down.sort((a,b)=>parseFloat(a.value)-parseFloat(b.value));
  setList($spikeUp, up); setList($spikeDown, down);

  const pre=[], over=[];
  for(const t of tickers){
    const r=(Number(t.signed_change_rate)||0)*100;
    const label=t.market.replace("KRW-",""), value=`${r.toFixed(2)}%`;
    if(r>=OVERHEAT_MIN_24H) over.push({label,value});
    else if(r>=PREHEAT_MIN_24H && r<=PREHEAT_MAX_24H) pre.push({label,value});
  }
  over.sort((a,b)=>parseFloat(b.value)-parseFloat(a.value));
  pre.sort((a,b)=>parseFloat(b.value)-parseFloat(a.value));
  setList($overheat, over); setList($preheat, pre);
}

function doSearch(){
  const q=($search?.value||"").trim().toUpperCase();
  if(!q) CURRENT_VIEW=["KRW-BTC"];
  else{
    const found=ALL_MARKETS.filter(m=>m.market.includes(q) || m.korean_name?.toUpperCase().includes(q));
    CURRENT_VIEW=(found.length?found:ALL_MARKETS.filter(m=>m.market==="KRW-BTC")).map(m=>m.market);
  }
  pullAndRender();
}

async function pullAndRender(){
  try{
    const tickers = await getTickers(CURRENT_VIEW);
    LAST_OK_TICKERS = tickers;
    LAST_OK_AT = Date.now();

    renderTable(tickers);
    updateSignals(tickers);

    FAILS = 0;
    lastTickAt = Date.now();
    setConnStatus("연결 안정", "#16a34a");
  }catch(e){
    FAILS++;
    const secs = Math.max(1, Math.floor((Date.now()-LAST_OK_AT)/1000));
    if (LAST_OK_TICKERS.length) {
      renderTable(LAST_OK_TICKERS, { stale: true });
      setConnStatus(`지연(${secs}s) · 복구중…(${FAILS}/${FAIL_LIMIT})`, "#ef4444");
    } else {
      setConnStatus(`복구중…(${FAILS}/${FAIL_LIMIT})`, "#ef4444");
    }
    if (FAILS >= FAIL_LIMIT) {
      FAILS = 0;
      setConnStatus("재연결 중…", "#ef4444");
      await init();
      return;
    }
  }
}

// 워치독: 3초 이상 멈추면 강제 갱신
setInterval(()=>{ if(Date.now()-lastTickAt > POLL_MS*3) pullAndRender(); }, 1500);

async function init(){
  try{
    setConnStatus("연결중…", "#16a34a");
    ALL_MARKETS = await getKRWMarkets();
    if (!ALL_MARKETS?.length) throw new Error("마켓 목록 실패");
    CURRENT_VIEW = ["KRW-BTC"];
    await pullAndRender();

    if (POLL_TIMER)   clearInterval(POLL_TIMER);
    if (HEART_TIMER)  clearInterval(HEART_TIMER);
    if (MARKETS_TIMER)clearInterval(MARKETS_TIMER);

    POLL_TIMER = setInterval(pullAndRender, POLL_MS);
    HEART_TIMER = setInterval(()=>{ try{ ping(); }catch{} }, 45_000);
    MARKETS_TIMER = setInterval(async ()=>{ try{ ALL_MARKETS = await getKRWMarkets(); }catch{} }, 5*60*1000);

    $btn?.addEventListener("click", doSearch);
    $search?.addEventListener("keydown", e=>{ if(e.key==="Enter") doSearch(); });
    $btnScanPreheat?.addEventListener("click", pullAndRender);

    window.addEventListener("online",  ()=>{ setConnStatus("온라인 – 재연결 시도", "#16a34a"); pullAndRender(); });
    window.addEventListener("offline", ()=>{ setConnStatus("오프라인 – 대기 중", "#ef4444"); });
    document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) pullAndRender(); });
  }catch{
    setConnStatus("초기화 오류 – 재시도", "#ef4444");
    setTimeout(init, 1200);
  }
}
init();
