// /js/main.js — 완성 통합버전
// ✅ 기존 기능 유지 + 검색 기능 추가 + tickers.filter 오류 수정 + 급등/급락 세트 정상작동

const $ = (s) => document.querySelector(s);
function asArray(x) {
  return Array.isArray(x) ? x : (x ? Object.values(x) : []);
}
function fmt(n) {
  return Number(n).toLocaleString("ko-KR");
}

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function renderMain(rows) {
  const tbody = $("#mainTbody");
  if (!tbody) return;

  tbody.innerHTML =
    (rows || [])
      .map(
        (r) => `
      <tr>
        <td>${r.nameKr}</td>
        <td class="right">${fmt(r.now)}원</td>
        <td class="right">${r.targets?.long?.B1 ? fmt(r.targets.long.B1) : "-"}</td>
        <td class="right">${r.targets?.long?.TP1 ? fmt(r.targets.long.TP1) : "-"}</td>
        <td>${r.warmState}</td>
      </tr>`
      )
      .join("") ||
    `<tr><td colspan="5">⚠️ 검색 결과 없음</td></tr>`;
}

function renderSpikeSets(spikes) {
  const box = $("#spikeSets");
  if (!box || !spikes) return;

  const list = (arr) =>
    arr && arr.length
      ? arr
          .map(
            (x) => `
    <div class="spike-item">
      <span class="coin">${x.nameKr} <span class="sym">(${x.symbol.replace("KRW-", "")})</span></span>
      <span class="info">${x.state} · ${x.changePct || x.change}% / ${x.volRatio || 1}x</span>
    </div>`
          )
          .join("")
      : `<div class="muted">없음</div>`;

  box.innerHTML = `
    <div class="spike-wrapper">
      <div class="spike-box"><h3>🔥 급등 한세트</h3>${list(spikes.up || [])}</div>
      <div class="spike-box"><h3>⚠️ 급락 한세트</h3>${list(spikes.down || [])}</div>
    </div>`;
}

let _debounceTimer = null;
function debounce(fn, wait = 400) {
  return (...args) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => fn(...args), wait);
  };
}

async function load(q = "") {
  try {
    $("#errorMsg")?.classList.add("hidden");
    $("#loading")?.classList.remove("hidden");

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    // ✅ tickers.filter 오류 수정 (객체 → 배열 변환)
    const tickers = Array.isArray(data.tickers)
      ? data.tickers
      : Object.values(data.tickers || {});
    window.tickers = tickers; // 항상 배열 상태로 전역 저장

    renderMain(data.rows || []);
    renderSpikeSets(data.spikes);

    const ts = $("#zz-upbit-ts");
    if (ts)
      ts.textContent = `업데이트: ${new Date(
        data.updatedAt || Date.now()
      ).toLocaleString()}`;
  } catch (e) {
    console.error(e);
    $("#mainTbody").innerHTML = `<tr><td colspan="5">⚠️ 스캔 실패: ${e.message}</td></tr>`;
  } finally {
    $("#loading")?.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = $("#search");
  const btn = $("#search-btn");
  const scan = $("#scan-btn");

  // 검색 버튼 클릭
  btn?.addEventListener("click", () => load(input?.value || ""));
  // Enter 입력
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") load(input.value || "");
  });
  // 입력 중 자동검색 (0.4초 디바운스)
  input?.addEventListener("input", debounce(() => load(input.value || "")));
  // 예열 스캔
  scan?.addEventListener("click", () => load(""));

  // 초기 실행 + 2초마다 새로고침
  load();
  setInterval(() => load(input?.value || ""), 2000);
});
