// /js/main.js — 검색 가능 버전 (기존 기능 유지 + 검색 버튼/엔터/실시간 반영)
// - /api/tickers?q=... 로 호출
// - 버튼 클릭, Enter 키, 입력 지연(디바운스) 모두 지원
// - 에러 메시지/로딩/타임스탬프 갱신 포함

const $ = (s) => document.querySelector(s);

function asArray(x){ return Array.isArray(x) ? x : (x ? Object.values(x) : []); }
function fmt(n){ return Number(n).toLocaleString("ko-KR"); }

async function fetchJSON(url){
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function renderMain(rows){
  // 기존 테이블 렌더 함수가 있으면 그대로 사용
  if (typeof window.updateWarmTable === "function") window.updateWarmTable(rows);
  if (typeof window.updateMainTable === "function") { window.updateMainTable(rows); return; }

  // 폴백 렌더 (기존 표가 없을 때 최소 표시)
  const tbody = $("#mainTbody");
  if (!tbody) return;
  tbody.innerHTML = (rows || []).map(r => `
    <tr>
      <td>${r.nameKr}</td>
      <td class="right">${fmt(r.now)}원</td>
      <td class="right">${r.targets?.long?.SL ? fmt(r.targets.long.SL) : "-"}</td>
      <td class="right">${r.targets?.long?.TP1 ? fmt(r.targets.long.TP1) : "-"}</td>
      <td>${r.warmState}</td>
    </tr>
  `).join("");
}

function renderSpikeSets(spikes){
  const box = $("#spikeSets");
  if (!box || !spikes) return;
  const list = (arr) => (arr && arr.length) ? arr.map(x => `
    <div class="spike-item">
      <span class="coin">${x.nameKr} <span class="sym">(${x.symbol.replace("KRW-","")})</span></span>
      <span class="info">${x.state} · ${x.changePct}% / ${x.volRatio}x</span>
    </div>
  `).join("") : `<div class="muted">없음</div>`;
  box.innerHTML = `
    <div class="spike-wrapper">
      <div class="spike-box"><h3>🔥 급등 한세트</h3>${list(spikes.up || [])}</div>
      <div class="spike-box"><h3>⚠️ 급락 한세트</h3>${list(spikes.down || [])}</div>
    </div>
  `;
}

let _debounceTimer = null;
function debounce(fn, wait = 300){
  return (...args) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => fn(...args), wait);
  };
}

async function load(q = ""){
  try{
    $("#errorMsg")?.classList.add("hidden");
    $("#loading")?.classList.remove("hidden");

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    // tickers는 배열로 보장 (다른 코드에서 쓸 수 있음)
    const tickers = asArray(data.tickers);

    // 메인/예열 렌더
    renderMain(data.rows || []);
    // 예열 밑 급등/급락 세트
    renderSpikeSets(data.spikes);

    // 타임스탬프
    const tsEl = $("#zz-upbit-ts");
    if (tsEl) tsEl.textContent = `업데이트: ${new Date(data.updatedAt || Date.now()).toLocaleString()}`;
  }catch(e){
    console.error(e);
    const tbody = $("#mainTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${e.message}</td></tr>`;
    $("#errorMsg") && ($("#errorMsg").textContent = `⚠️ 오류: ${e.message}`, $("#errorMsg").classList.remove("hidden"));
  }finally{
    $("#loading")?.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = $("#search");
  const btn = $("#search-btn");
  const scan = $("#scan-btn");

  // 1) 버튼 클릭 검색
  btn?.addEventListener("click", () => load(input?.value || ""));

  // 2) Enter 검색
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") load(input.value || "");
  });

  // 3) 타이핑 중 자동 검색(디바운스)
  input?.addEventListener("input", debounce(() => {
    load(input.value || "");
  }, 400));

  // 4) 예열 스캔 버튼(옵션: 전체 검색)
  scan?.addEventListener("click", () => load(""));

  // 최초 로드 + 주기 갱신
  load();
  setInterval(() => load(input?.value || ""), 1500);
});
