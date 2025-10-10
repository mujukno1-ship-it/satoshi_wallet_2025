import { connectWS, onTicker, subscribe } from "./upbit_ws.js";
import { runScannerLoop } from "./scanner.js";

const API = "https://api.upbit.com";
let marketsCache = null;
let unbind = null;

// 초기화
window.addEventListener("DOMContentLoaded", async ()=>{
  connectWS();
  runScannerLoop();

  marketsCache = await fetchJSON(`${API}/v1/market/all?isDetails=false`);
  document.getElementById("search-btn").addEventListener("click", onSearch);
  document.getElementById("search-input").addEventListener("keydown", (e)=>{
    if(e.key==="Enter") onSearch();
  });
});

// 검색 실행
async function onSearch(){
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  if (!q){ return; }

  // 1) 매칭(한글명/영문심볼/마켓코드)
  const hit = marketsCache.find(m =>
    m.market.toLowerCase() === q ||
    m.korean_name.replace(/\s/g,"").toLowerCase().includes(q.replace(/\s/g,"")) ||
    m.english_name?.toLowerCase().includes(q)
  ) || marketsCache.find(m => m.market.toLowerCase().endsWith(q));

  if (!hit){ renderEmpty("검색 결과 없음"); return; }

  // 2) WS 구독
  subscribe([hit.market]);

  // 3) Ticker 수신 → 테이블 렌더
  if (unbind) unbind();
  unbind = onTicker((tk)=>{
    if (tk.code !== hit.market) return;
    const rate = (tk.signed_change_rate*100).toFixed(2);
    const trp = toKRW(tk.trade_price);
    const row = `
      <tr>
        <td>${hit.korean_name} (${hit.market})</td>
        <td class="price ${tk.change==='RISE'?'up':(tk.change==='FALL'?'down':'')}">${trp}</td>
        <td>${rate}%</td>
        <td>${statusFromRate(tk.signed_change_rate)}</td>
        <td>${riskFromRate(tk.signed_change_rate)}</td>
        <td>—</td>
        <td>—</td>
        <td>${decisionFromRate(tk.signed_change_rate)}</td>
      </tr>`;
    document.getElementById("result-body").innerHTML = row;
  });
}

function statusFromRate(r){
  if (r>=0.05) return "급등";
  if (r>=0.02) return "예열";
  if (r<=-0.02) return "가열(하락)";
  return "중립";
}
function riskFromRate(r){
  // 쩐다 기본 원칙: 안전 위주(1~5)
  if (r>=0.05) return "3";
  if (r>=0.02) return "2";
  if (r<=-0.02) return "3";
  return "1";
}
function decisionFromRate(r){
  if (r>=0.05) return "분할익절/추격주의";
  if (r>=0.02) return "관망→눌림 매수 후보";
  if (r<=-0.02) return "저점 분할대기";
  return "관망";
}

function renderEmpty(msg){
  document.getElementById("result-body").innerHTML =
    `<tr><td colspan="8" class="empty">${msg}</td></tr>`;
}

function toKRW(n){ return new Intl.NumberFormat("ko-KR").format(n); }
async function fetchJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(r.status); return r.json(); }
