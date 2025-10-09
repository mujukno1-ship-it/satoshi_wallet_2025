// ========= 공통 유틸 =========
const $ = (sel) => document.querySelector(sel);
const asArr = (v) => (Array.isArray(v) ? v : (v ? Object.values(v) : []));
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("ko-KR") : n);

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

let _debTimer = null;
const debounce = (fn, wait = 400) => (...args) => {
  clearTimeout(_debTimer);
  _debTimer = setTimeout(() => fn(...args), wait);
};

// ========= 렌더러 =========

// 🔥 급등/⚠️ 급락 — 객체({up,down})/배열 모두 안전 처리 + 클릭 검색
function renderSpikeSets(spikes) {
  const box = $("#spikeSets");
  if (!box) return;

  const up = Array.isArray(spikes) ? spikes : asArr(spikes?.up);
  const down = Array.isArray(spikes) ? [] : asArr(spikes?.down);

  const itemHtml = (x) => `
    <div class="spike-item" data-symbol="${x.symbol || ""}">
      <span class="coin">${x.nameKr || x.symbol || "-"}</span>
      <span class="info">${fmt(x.changePct ?? x.change ?? 0)}%</span>
    </div>`;

  box.innerHTML = `
    <div class="spike-wrapper">
      <div class="spike-box">
        <h3>🔥 급등 한세트</h3>
        ${up.length ? up.map(itemHtml).join("") : `<div class="muted">없음</div>`}
      </div>
      <div class="spike-box">
        <h3>⚠️ 급락 한세트</h3>
        ${down.length ? down.map(itemHtml).join("") : `<div class="muted">없음</div>`}
      </div>
    </div>`;

  // 새 기능: 급등/급락 항목 클릭 → 검색 실행
  box.querySelectorAll(".spike-item[data-symbol]").forEach((el) => {
    el.addEventListener("click", () => {
      const sym = el.getAttribute("data-symbol") || "";
      const input = $("#search");
      if (input && sym) {
        input.value = sym;
        load(sym);
      }
    });
  });
}

// ♨️ 예열/가열 — 어떤 형태든 배열로 변환하여 10개만 표시
function renderWarmCoins(list) {
  const warmDiv = $("#warmCoins");
  if (!warmDiv) return;

  const arr = asArr(list).slice(0, 10);
  warmDiv.innerHTML = arr.length
    ? arr
        .map((c) => {
          const name =
            c.nameKr || c.korean_name || c.market || c.symbol || "-";
          const now = c.now ?? c.trade_price ?? "-";
          const state = c.warmState || c.state || "";
          return `<div class="coin-item">
            <span class="name">${name}</span>
            <span class="price">${fmt(now)}</span>
            <span class="state">${state}</span>
          </div>`;
        })
        .join("")
    : `<div class="muted">없음</div>`;
}

// 📊 메인 테이블 — 기존 컬럼 유지 + 변동률(있으면) 보조 표기
function renderMainTable(rows) {
  const tbody = $("#mainTbody");
  if (!tbody) return;

  const arr = asArr(rows);
  tbody.innerHTML = arr.length
    ? arr
        .map((r) => {
          const name =
            r.nameKr || r.namekr || r.korean_name || r.symbol || "-";
          const now = r.now ?? r.trade_price ?? "-";
          const b1 = r.targets?.long?.B1 ?? r.buy1 ?? "-";
          const tp1 = r.targets?.long?.TP1 ?? r.sell1 ?? "-";
          const st = r.warmState || r.state || "-";
          const chg = r.change ?? r.changePct;
          const chgHtml =
            typeof chg === "number"
              ? `<small class="muted"> (${chg > 0 ? "+" : ""}${chg}%)</small>`
              : "";
          return `<tr>
            <td>${name}</td>
            <td class="right">${fmt(now)}${chgHtml}</td>
            <td class="right">${fmt(b1)}</td>
            <td class="right">${fmt(tp1)}</td>
            <td>${st}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5">데이터 없음</td></tr>`;
}

// ========= 로드/검색 =========
async function load(q = "") {
  try {
    $("#errorMsg")?.classList.add("hidden");
    $("#zz-upbit-ts")?.classList.add("muted");
    $("#zz-upbit-ts") && ($("#zz-upbit-ts").innerText = "📈 데이터 갱신 중…");

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    // ✅ tickers: 어떤 형태든 배열로 보장 (filter/map 안전)
    const tickers = asArr(data.tickers);
    window.tickers = tickers;

    renderSpikeSets(data.spikes);       // 객체 {up,down} 그대로 전달
    renderWarmCoins(tickers);
    renderMainTable(data.rows || []);

    $("#zz-upbit-ts") &&
      ($("#zz-upbit-ts").innerText =
        "✅ 업데이트 완료 " +
        new Date(data.updatedAt || Date.now()).toLocaleTimeString());
    $("#zz-upbit-ts")?.classList.remove("muted");
  } catch (e) {
    const tbody = $("#mainTbody");
    tbody &&
      (tbody.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${e.message}</td></tr>`);
    const err = $("#errorMsg");
    err && ((err.textContent = `⚠️ ${e.message}`), err.classList.remove("hidden"));
    console.error(e);
  }
}

// ========= 초기화 =========
document.addEventListener("DOMContentLoaded", () => {
  const input = $("#search");
  const btn = $("#search-btn");
  const scan = $("#scan-btn");

  // 기존 기능 유지: 버튼/엔터 검색
  btn?.addEventListener("click", () => load(input?.value || ""));
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") load(input.value || "");
  });

  // 새로운 기능: 실시간 자동검색(디바운스)
  input?.addEventListener("input", debounce(() => load(input.value || "")));

  // 기존 기능 유지: 예열 스캔(전체)
  scan?.addEventListener("click", () => {
    if (input) input.value = "";
    load("");
  });

  // 초기 로드 + 자동 새로고침(과부하 방지를 위해 3~4초 권장)
  load();
  setInterval(() => load(input?.value || ""), 4000);
});
