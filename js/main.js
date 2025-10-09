// ===== 공통 유틸 =====
const $ = (s)=>document.querySelector(s);
const asArr = (v)=>Array.isArray(v)?v:(v?Object.values(v):[]);
const fmt = (n)=> (typeof n==="number" ? n.toLocaleString("ko-KR") : n);

async function fetchJSON(url){
  const r = await fetch(url, { headers:{ accept:"application/json" } });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
let _debTimer=null;
const debounce=(fn, wait=400)=>(...a)=>{ clearTimeout(_debTimer); _debTimer=setTimeout(()=>fn(...a), wait); };

// ===== 렌더러 =====

// 🔥/⚠️ 급등·급락 — 객체/배열 안전 처리 + 클릭검색
function renderSpikeSets(spikes){
  const box=$("#spikeSets"); if(!box) return;
  const up = Array.isArray(spikes) ? spikes : asArr(spikes?.up);
  const down = Array.isArray(spikes) ? [] : asArr(spikes?.down);

  const item = (x)=>`
    <div class="spike-item" data-symbol="${x.symbol||""}">
      <span class="coin">${x.nameKr || x.symbol || "-"}</span>
      <span class="info">${typeof x.change==="number" ? (x.change>0?"+":"")+x.change+"%" : "-"}</span>
    </div>`;

  box.innerHTML = `
    <div class="spike-wrapper">
      <div class="spike-box"><h3>🔥 급등 한세트</h3>${up.length?up.map(item).join(""):`<div class="muted">없음</div>`}</div>
      <div class="spike-box"><h3>⚠️ 급락 한세트</h3>${down.length?down.map(item).join(""):`<div class="muted">없음</div>`}</div>
    </div>`;

  box.querySelectorAll(".spike-item[data-symbol]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const sym = el.getAttribute("data-symbol");
      const input = $("#search");
      if (sym && input){ input.value = sym; load(sym); }
    });
  });
}

// ♨️ 예열/검색 결과 — 동일 포맷(원본 호가 그대로 표시)
function renderWarmCoins(list, label="♨️ 예열/가열 코인"){
  const wrap=$("#warm-section"); const warm=$("#warmCoins");
  if (!warm) return;

  const arr = asArr(list).slice(0, 10);
  const rowsHTML = arr.length ? arr.map((c)=>{
    const name = c.nameKr || c.korean_name || c.symbol || "-";
    const sym  = c.symbol || "-";
    const now  = c.now ?? c.trade_price ?? "-";
    // ✅ 호가: 서버에서 온 "원본 값" 그대로 사용 (반올림 X)
    const bid  = c.order?.bid ?? "-";
    const ask  = c.order?.ask ?? "-";
    const b1   = c.targets?.long?.B1 ?? "-";
    const tp1  = c.targets?.long?.TP1 ?? "-";
    const sl   = c.targets?.long?.SL ?? "-";
    const risk = c.risk ?? 2;
    const comment = c.comment || "-";
    const st = c.warmState || "-";
    const stime = c.startTime ? new Date(c.startTime).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : "-";
    const etime = c.endTime ? new Date(c.endTime).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : "-";
    const dots = "●●●●●".slice(0,risk) + "○○○○○".slice(risk);

    return `
      <tr data-symbol="${sym}">
        <td>${name} <small class="muted">(${sym.replace("KRW-","")})</small></td>
        <td class="right">${fmt(now)}</td>
        <td class="right">${fmt(bid)}</td>
        <td class="right">${fmt(ask)}</td>
        <td class="right">${fmt(b1)}</td>
        <td class="right">${fmt(tp1)}</td>
        <td class="right">${fmt(sl)}</td>
        <td class="center" title="위험도 ${risk}/5">${dots.slice(0,5)}</td>
        <td>${comment}</td>
        <td class="center">${stime}</td>
        <td class="center">${etime}</td>
        <td>${st}</td>
      </tr>`;
  }).join("") : `<tr><td colspan="12" class="muted">현재 ${label.includes("검색")?"검색 결과":"예열 코인"} 없음</td></tr>`;

  const h2 = wrap?.querySelector("h2");
  if (h2) h2.textContent = label;

  warm.innerHTML = `
    <table class="warm-table">
      <thead>
        <tr>
          <th>코인명</th>
          <th>현재가</th>
          <th>매수(1호가)</th>
          <th>매도(1호가)</th>
          <th>매수(B1)</th>
          <th>매도(TP1)</th>
          <th>손절(SL)</th>
          <th>위험도</th>
          <th>쩔어 한마디</th>
          <th>예열 시작</th>
          <th>예열 종료</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>`;

  warm.querySelectorAll("tbody tr[data-symbol]").forEach(tr=>{
    tr.addEventListener("click", ()=>{
      const sym = tr.getAttribute("data-symbol");
      const input = $("#search");
      if (sym && input){ input.value = sym; load(sym); }
    });
  });
}

// 📊 메인 테이블(기존 컬럼 유지)
function renderMainTable(rows){
  const tbody=$("#mainTbody"); if(!tbody) return;
  const arr = asArr(rows);
  tbody.innerHTML = arr.length ? arr.map(r=>{
    const name = r.nameKr || r.namekr || r.korean_name || r.symbol || "-";
    const now  = r.now ?? r.trade_price ?? "-";
    const b1   = r.targets?.long?.B1 ?? r.buy1 ?? "-";
    const tp1  = r.targets?.long?.TP1 ?? r.sell1 ?? "-";
    const st   = r.warmState || r.state || "-";
    const chg  = typeof r.change==="number" ? ` <small class="muted">(${r.change>0?"+":""}${r.change}%)</small>` : "";
    return `
      <tr>
        <td>${name}</td>
        <td class="right">${fmt(now)}${chg}</td>
        <td class="right">${fmt(b1)}</td>
        <td class="right">${fmt(tp1)}</td>
        <td>${st}</td>
      </tr>`;
  }).join("") : `<tr><td colspan="5">데이터 없음</td></tr>`;
}

// ===== 로드/검색 =====
async function load(q=""){
  try{
    $("#errorMsg")?.classList.add("hidden");
    const ts=$("#zz-upbit-ts"); if(ts){ ts.classList.add("muted"); ts.textContent="📈 데이터 갱신 중…"; }

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    const tickers = asArr(data.tickers);
    window.tickers = tickers;

    renderSpikeSets(data.spikes); // 검색과 무관(독립)
    renderWarmCoins(q ? (data.rows || tickers) : tickers, q ? "🔍 검색 결과" : "♨️ 예열/가열 코인");
    renderMainTable(data.rows || []);

    const txt = "✅ 업데이트 완료 " + new Date(data.updatedAt || Date.now()).toLocaleTimeString();
    if (ts){ ts.textContent = txt; ts.classList.remove("muted"); }
  } catch (e) {
    const tbody=$("#mainTbody");
    tbody && (tbody.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${e.message}</td></tr>`);
    const err=$("#errorMsg"); if(err){ err.textContent=`⚠️ ${e.message}`; err.classList.remove("hidden"); }
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  const input=$("#search"), btn=$("#search-btn"), scan=$("#scan-btn");

  // 기존: 버튼/엔터 검색
  btn?.addEventListener("click", ()=>load(input?.value||""));
  input?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(input.value||""); });

  // 새 기능: 자동검색(디바운스)
  input?.addEventListener("input", debounce(()=>load(input.value||"")));

  // 기존: 예열 스캔(전체)
  scan?.addEventListener("click", ()=>{ if(input) input.value=""; load(""); });

  // 초기 로드 + 자동 새로고침
  load();
  setInterval(()=>load(input?.value||""), 4000);
});
