// /js/main.js
const $ = (s)=>document.querySelector(s);

async function fetchJSON(url){
  const r = await fetch(url,{headers:{accept:"application/json"}});
  if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
function fmt(n){ return Number(n).toLocaleString("ko-KR"); }

function renderMain(rows){
  if(typeof window.updateWarmTable==="function") window.updateWarmTable(rows);
  if(typeof window.updateMainTable==="function"){ window.updateMainTable(rows); return; }
  const tbody = document.querySelector("#mainTbody"); if(!tbody) return;
  tbody.innerHTML = (rows||[]).map(r=>`
    <tr>
      <td>${r.nameKr}</td>
      <td class="right">${fmt(r.now)}원</td>
      <td class="right">${r.buy}</td>
      <td class="right">${r.sell}</td>
      <td class="right">${fmt(r.sl)}원</td>
      <td class="right">${fmt(r.tp)}원</td>
      <td class="right">${r.risk}</td>
      <td>${r.warmState}</td>
    </tr>`).join("");
}

function renderSpikeSets(spikes){
  const box=$("#spikeSets"); if(!box||!spikes) return;
  const list=(arr)=>(arr&&arr.length)?arr.map(x=>`
    <div class="spike-item">
      <span class="coin">${x.nameKr} <span class="sym">(${x.symbol.replace("KRW-","")})</span></span>
      <span class="info">${x.state} · ${x.changePct}% / ${x.volRatio}x</span>
    </div>`).join(""):`<div class="muted">없음</div>`;
  box.innerHTML = `
    <div class="spike-wrapper">
      <div class="spike-box"><h3>🔥 급등 한세트</h3>${list(spikes.up)}</div>
      <div class="spike-box"><h3>⚠️ 급락 한세트</h3>${list(spikes.down)}</div>
    </div>`;
}

async function load(q=""){
  try{
    $("#errorMsg")?.classList.add("hidden");
    const url=q?`/api/tickers?q=${encodeURIComponent(q)}`:"/api/tickers";
    const data=await fetchJSON(url);

    // ✅ tickers 배열 보장 (혹시 객체로 올 때 대비)
    const tickers = Array.isArray(data.tickers) ? data.tickers : Object.values(data.tickers||{});

    // 기존 렌더 + 스파이크 세트
    renderMain(data.rows||[]);
    renderSpikeSets(data.spikes);

    const ts = new Date(data.updatedAt||Date.now()).toLocaleString();
    const tsEl = document.querySelector("#zz-upbit-ts"); if(tsEl) tsEl.textContent=`업데이트: ${ts}`;
  }catch(e){
    console.error(e);
    const row = document.querySelector("#coin-table tbody");
    if(row) row.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${e.message}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  const input=$("#search"), btn=$("#search-btn"), scan=$("#scan-btn");
  btn?.addEventListener("click",()=>load(input?.value||""));
  input?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(input.value||""); });
  scan?.addEventListener("click",()=>load("")); // 필요 시 스캔 로직 유지

  load();
  setInterval(()=>load($("#search")?.value||""),1500);
});
