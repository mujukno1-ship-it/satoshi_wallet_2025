// /js/main.js — 화면 스크립트 (기존기능유지 + 급등/급락 세트 표시 + 오류가드)

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fmt(n) { return Number(n).toLocaleString("ko-KR"); }

function renderTableFallback(rows) {
  // 기존에 네가 쓰는 updateTable / updateWarmTable이 있으면 그걸 그대로 사용
  if (typeof window.updateWarmTable === "function") window.updateWarmTable(rows);
  if (typeof window.updateMainTable === "function") { window.updateMainTable(rows); return; }

  // 없을 때를 위한 최소 렌더 (깨지지 않게)
  const tbody = $("#mainTbody");
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.nameKr}</td>
      <td>${fmt(r.now)}원</td>
      <td>${r.buy}</td>
      <td>${r.sell}</td>
      <td>${fmt(r.sl)}원</td>
      <td>${fmt(r.tp)}원</td>
      <td>${r.risk}</td>
      <td>${r.warmState}</td>
    </tr>
  `).join("");
}

function renderSpikeSets(spikes) {
  const box = $("#spikeSets");
  if (!box || !spikes) return;
  const renderList = (list) => list.length
    ? list.map(x => `
        <div class="spike-item">
          <span class="coin">${x.nameKr} <span class="sym">(${x.symbol.replace("KRW-","")})</span></span>
          <span class="info">${x.state} · ${x.changePct}% / ${x.volRatio}x</span>
        </div>`).join("")
    : `<div class="muted">없음</div>`;
  box.innerHTML = `
    <div class="spike-wrapper">
      <div class="spike-box">
        <h3>🔥 급등 한세트</h3>
        ${renderList(spikes.up || [])}
      </div>
      <div class="spike-box">
        <h3>⚠️ 급락 한세트</h3>
        ${renderList(spikes.down || [])}
      </div>
    </div>
  `;
}

async function load(q = "") {
  try {
    $("#errorMsg")?.classList.add("hidden");
    $("#loading")?.classList.remove("hidden");

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    // 표/예열 (기존 함수 사용 + 폴백)
    renderTableFallback(data.rows || []);
    // 예열 밑 급등/급락 세트
    renderSpikeSets(data.spikes);

    $("#updatedAt") && ($("#updatedAt").textContent = new Date(data.updatedAt || Date.now()).toLocaleString());
  } catch (e) {
    console.error(e);
    $("#errorMsg") && ($("#errorMsg").textContent = `불러오기 실패: ${e.message}`, $("#errorMsg").classList.remove("hidden"));
  } finally {
    $("#loading")?.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // 검색
  const input = $("#searchInput");
  const btn = $("#searchBtn");
  btn?.addEventListener("click", () => load(input?.value || ""));
  input?.addEventListener("keydown", (e) => { if (e.key === "Enter") load(input.value || ""); });

  // 최초 로드 & 주기 갱신(1초~3초 사이에서 선택)
  load();
  setInterval(() => load($("#searchInput")?.value || ""), 1500);
});
