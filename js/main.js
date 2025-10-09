// /js/main.js — 기능 유지 + 검색 동작 + tickers.filter 오류영구해결
const $ = (s)=>document.querySelector(s);
const fmt = (n)=>Number(n).toLocaleString("ko-KR");
const asArray = (x)=>Array.isArray(x)?x:(x?Object.values(x):[]);

async function fetchJSON(url){
  const r = await fetch(url,{headers:{accept:"application/json"}});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// 기존 전역 렌더 함수가 있으면 그대로 사용 (안 깨짐)
function renderMain(rows){
  if(typeof window.updateWarmTable==="function") window.updateWarmTable(rows);
  if(typeof window.updateMainTable==="function"){ window.updateMainTable(rows); return; }

  // 폴백 렌더 (없을 때만)
  const tbody = $("#mainTbody"); if(!tbody) return;
  tbody.innerHTML = (rows||[]).map(r=>`
    <tr>
      <td>${r.nameKr}</td>
      <td class="right">${fmt(r.now)}원</td>
      <td class="right">${r.targets?.long?.B1?fmt(r.targets.long.B1):"-"}</td>
      <td class="right">${r.targets?.long?.TP1?fmt(r.targets.long.TP1):"-"}</td>
      <td>${r.warmState||"-"}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">검색 결과 없음</td></tr>`;
}

function renderSpikeSets(spikes){
  const box=$("#spikeSets"); if(!box||!spikes) return;
  const list=(arr)=>(arr&&arr.length)?arr.map(x=>`
    <div class="spike-item">
      <span class="coin">${x.nameKr||x.symbol} <span class="sym">(${(x.symbol||"").replace("KRW-","")})</span></span>
      <span class="info">${x.state||x.warmState||""} · ${(x.changePct??x.change??0)}%</span>
    </div>`).join(""):`<div class="muted">없음</div>`;
  box.innerHTML=`
    <div class="spike-wrapper">
      <div class="spike-box"><h3>🔥 급등 한세트</h3>${list(spikes.up||[])}</div>
      <div class="spike-box"><h3>⚠️ 급락 한세트</h3>${list(spikes.down||[])}</div>
    </div>`;
}

let _timer=null;
const debounce=(fn,wait=400)=>(...a)=>{ clearTimeout(_timer); _timer=setTimeout(()=>fn(...a),wait); };

async function load(q=""){
  try{
    $("#errorMsg")?.classList.add("hidden");
    $("#loading")?.classList.remove("hidden");

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    // ✅ 어디서든 filter 써도 되게 tickers를 항상 '배열'로 보장
    const tickers = asArray(data.tickers);
    window.tickers = tickers;

    renderMain(data.rows||[]);
    renderSpikeSets(data.spikes);

    const ts = $("#zz-upbit-ts");
    if(ts) ts.textContent = `업데이트: ${new Date(data.updatedAt||Date.now()).toLocaleString()}`;
  }catch(e){
    console.error(e);
    const tbody=$("#mainTbody");
    tbody && (tbody.innerHTML = `<tr><td colspan="5">⚠️ 스캔 실패: ${e.message}</td></tr>`);
    const err=$("#errorMsg"); if(err){ err.textContent=`⚠️ ${e.message}`; err.classList.remove("hidden"); }
  }finally{
    $("#loading")?.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  const input=$("#search"), btn=$("#search-btn"), scan=$("#scan-btn");

  btn?.addEventListener("click", ()=>load(input?.value||""));         // 버튼 검색
  input?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") load(input.value||""); }); // 엔터 검색
  input?.addEventListener("input", debounce(()=>load(input.value||""))); // 타이핑 자동 검색
  scan?.addEventListener("click", ()=>load(""));                      // 예열 스캔(전체)

  load();                         // 초기 로드
  setInterval(()=>load(input?.value||""), 2000); // 자동 새로고침
});
