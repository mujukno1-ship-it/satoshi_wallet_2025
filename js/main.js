// /js/main.js — 검색 동작+오류가드 완성본
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n).toLocaleString("ko-KR");
const asArray = (x) => (Array.isArray(x) ? x : (x ? Object.values(x) : []));

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function renderMain(rows) {
  const tbody = $("#mainTbody");
  if (!tbody) return;
  tbody.innerHTML =
    (rows || []).map((r) => `
      <tr>
        <td>${r.nameKr}</td>
        <td class="right">${fmt(r.now)}원</td>
        <td class="right">${r.targets?.long?.B1 ? fmt(r.targets.long.B1) : "-"}</td>
        <td class="right">${r.targets?.long?.TP1 ? fmt(r.targets.long.TP1) : "-"}</td>
        <td>${r.warmState || "-"}</td>
      </tr>
    `).join("") || `<tr><td colspan="5">검색 결과 없음</td></tr>`;
}

function renderSpikeSets(spikes) {
  const box = $("#spikeSets");
  if (!box || !spikes) return;
  const list = (arr) => (arr && arr.length)
    ? arr.map((x) => `
        <div class="spike-item">
          <span class="coin">${x.nameKr} <span class="sym">(${x.symbol.replace("KRW-","")})</span></span>
          <span class="info">${x.state || x.warmState || ""} · ${(x.changePct ?? x.change ?? 0)}% ${(x.volRatio ? `/ ${x.volRatio}x` : "")}</span>
        </div>`).join("")
    : `<div class="muted">없음</div>`;
  box.innerHTML = `
    <div class="spike-wrapper">
      <div class="spike-box"><h3>🔥 급등 한세트</h3>${list(spikes.up || [])}</div>
      <div class="spike-box"><h3>⚠️ 급락 한세트</h3>${list(spikes.down || [])}</div>
    </div>`;
}

let _debounce;
function debounce(fn, wait = 400) {
  return (...args) => { clearTimeout(_debounce); _debounce = setTimeout(() => fn(...args), wait); };
}

async function load(q = "") {
  try {
    $("#errorMsg")?.classList.add("hidden");
    $("#loading")?.classList.remove("hidden");

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    // ✅ tickers를 항상 배열로 보장 (어디서 filter 써도 안전)
    const tickers = asArray(data.tickers);
    window.tickers = tickers;

    renderMain(data.rows || []);
    renderSpikeSets(data.spikes);

    const ts = $("#zz-upbit-ts");
    if (ts) ts.textContent = `업데이트: ${new Date(data.updatedAt || Date.now()).toLocaleString()}`;
  } catch (e) {
    console.error(e);
    $("#mainTbody")?.insertAdjacentHTML("afterbegin",
      `<tr><td colspan="5">⚠️ 스캔 실패: ${e.message}</td></tr>`);
    $("#errorMsg") && ($("#errorMsg").textContent = `⚠️ ${e.message}`, $("#errorMsg").classList.remove("hidden"));
  } finally {
    $("#loading")?.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = $("#search");
  const btn = $("#search-btn");
  const scan = $("#scan-btn");

  // 🔍 버튼 클릭
  btn?.addEventListener("click", () => load(input?.value || ""));
  // ⏎ 엔터로 검색
  input?.addEventListener("keydown", (e) => { if (e.key === "Enter") load(input.value || ""); });
  // ⌨️ 타이핑 0.4초 멈추면 자동 검색
  input?.addEventListener("input", debounce(() => load(input.value || "")));
  // ♨️ 예열 스캔(전체)
  scan?.addEventListener("click", () => load(""));

  // 초기 로드 + 주기 갱신
  load();
  setInterval(() => load(input?.value || ""), 2000);
});
