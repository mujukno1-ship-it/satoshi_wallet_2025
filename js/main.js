/** --------------------------------------------------------------
 *  js/main.js (안정 복원판)
 *  - 기존 기능 유지 (검색/표/예열/급등·급락/업데이트표시)
 *  - 검색하면 "검색결과 + 예열" 동시 표시
 *  - 네트워크/요소 누락 가드
 * -------------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);
const asArr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("ko-KR") : (n ?? "-"));

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* 동적 섹션 (검색결과) : 기존 검색 UI(#search-section)는 건드리지 않음 */
function ensureSection(id, title) {
  let sec = document.querySelector(`#${id}`);
  if (!sec) {
    const warmSec = document.querySelector("#warm-section");
    sec = document.createElement("section");
    sec.id = id;
    sec.innerHTML = `
      <h2>${title}</h2>
      <div id="${id === "search-results" ? "searchResults" : "warmCoins"}"></div>
    `;
    if (warmSec && warmSec.parentNode) warmSec.parentNode.insertBefore(sec, warmSec);
  } else {
    const h2 = sec.querySelector("h2");
    if (h2) h2.textContent = title;
  }
  return sec;
}

/* 예열/검색 표 렌더러 (컨테이너 지정) */
function renderWarmCoins(list, label = "♨️ 예열/가열 코인", targetId = "warmCoins") {
  const wrap = $("#warm-section");
  const warm = document.querySelector(`#${targetId}`);
  if (!warm) return;

  if (wrap && targetId === "warmCoins") {
    const h2 = wrap.querySelector("h2");
    if (h2) h2.textContent = label;
  }

  const arr = asArr(list);

  const rowsHTML = arr.length
    ? arr.map((c) => {
        const name = c.nameKr || c.korean_name || (c.symbol || "").replace("KRW-","") || "-";
        const now  = c.now ?? c.trade_price ?? "-";
        const bid  = c.order?.bid ?? "-";
        const ask  = c.order?.ask ?? "-";
        const B1   = c.targets?.long?.B1 ?? "-";
        const TP1  = c.targets?.long?.TP1 ?? "-";
        const SL   = c.targets?.long?.SL ?? "-";
        const risk = c.risk ?? 0;
        const dots = "●●●●●".slice(0, risk) + "○○○○○".slice(risk);
        const comment = c.comment || "-";
        const st  = c.warmState || "-";
        const stime = c.startTime ? new Date(c.startTime).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : "-";
        const etime = c.endTime ? new Date(c.endTime).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : "-";

        return `
          <tr>
            <td>${name}</td>
            <td class="right">${fmt(now)}</td>
            <td class="right">${fmt(bid)}</td>
            <td class="right">${fmt(ask)}</td>
            <td class="right">${fmt(B1)}</td>
            <td class="right">${fmt(TP1)}</td>
            <td class="right">${fmt(SL)}</td>
            <td class="center" title="위험도 ${risk}/5">${dots.slice(0,5)}</td>
            <td>${comment}</td>
            <td class="center">${stime}</td>
            <td class="center">${etime}</td>
            <td>${st}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="12" class="muted">표시할 데이터가 없습니다.</td></tr>`;

  warm.innerHTML = `
    <table class="warm-table">
      <thead>
        <tr>
          <th>코인명</th><th>현재가</th><th>매수(1호가)</th><th>매도(1호가)</th>
          <th>매수(B1)</th><th>매도(TP1)</th><th>손절(SL)</th><th>위험도</th>
          <th>쩔어 한마디</th><th>예열 시작</th><th>예열 종료</th><th>상태</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>`;
}

/* 급등/급락 카드 (기존 함수 있을 수 있으니 존재 시만 호출하는 곳에서 사용) */
function renderSpikeSets(spikes){
  const hotBox = document.querySelector("#hot-set");
  const coldBox = document.querySelector("#cold-set");
  if (!spikes) return;
  if (hotBox) {
    hotBox.innerHTML = (spikes.hot || []).map(s => `<div>${s.symbol} <small>${(s.pct*100).toFixed(2)}%</small></div>`).join("") || "없음";
  }
  if (coldBox) {
    coldBox.innerHTML = (spikes.cold || []).map(s => `<div>${s.symbol} <small>${(s.pct*100).toFixed(2)}%</small></div>`).join("") || "없음";
  }
}

/* 메인 표 (기존 템플릿에 맞춰 최소 구성) */
function renderMainTable(rows){
  const tbody = $("#mainTbody");
  if (!tbody) return;
  const html = (rows||[]).map(r => `
    <tr>
      <td>${r.nameKr || (r.symbol||"").replace("KRW-","")}</td>
      <td class="right">${fmt(r.now)}</td>
      <td class="right">${fmt(r.order?.bid)}</td>
      <td class="right">${fmt(r.order?.ask)}</td>
      <td>중립</td>
    </tr>
  `).join("") || `<tr><td colspan="12">데이터 없음</td></tr>`;
  tbody.innerHTML = html;
}

/* 로드/검색 */
async function load(q = "") {
  try {
    const ts = $("#zz-upbit-ts");
    if (ts){ ts.classList.add("muted"); ts.textContent = "📈 데이터 갱신 중…"; }
    $("#errorMsg")?.classList.add("hidden");

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";

    // 타임아웃 + 에러 가드
    let data;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { headers: { accept:"application/json" }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      const tbody = $("#mainTbody");
      if (tbody) tbody.innerHTML = `<tr><td colspan="12">⚠️ 로딩 실패: ${e.name==='AbortError'?'네트워크 지연(10초 초과)':(e.message||e)}</td></tr>`;
      if (ts){ ts.textContent = "⚠️ 데이터 갱신 실패"; ts.classList.remove("muted"); }
      console.error(e);
      return;
    }

    // 급등/급락
    if (data.spikes) renderSpikeSets(data.spikes);

    // 검색결과 + 예열 동시 렌더
    if (q) {
      ensureSection("search-results", "🔍 검색 결과");
      renderWarmCoins(data.rows || [], "🔍 검색 결과", "searchResults");
      try {
        const base = await fetchJSON("/api/tickers");
        renderWarmCoins(base.rows || [], "♨️ 예열/가열 코인", "warmCoins");
      } catch {}
    } else {
      const s = document.querySelector("#search-results");
      if (s) s.remove();
      renderWarmCoins(data.rows || [], "♨️ 예열/가열 코인", "warmCoins");
    }

    // 메인 표
    renderMainTable(data.rows || []);

    if (ts){
      const t = new Date(data.updatedAt || Date.now());
      ts.textContent = "✅ 업데이트 완료 " + t.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
      ts.classList.remove("muted");
    }
  } catch (e) {
    const tbody = $("#mainTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${e.message||e}</td></tr>`;
    const err = $("#errorMsg"); if (err){ err.textContent = `⚠️ ${e.message||e}`; err.classList.remove("hidden"); }
    console.error(e);
  }
}

/* 초기 이벤트 */
document.addEventListener("DOMContentLoaded", () => {
  const input = $("#search");
  const btn   = $("#search-btn");
  const scan  = $("#scan-btn");

  if (btn)   btn.addEventListener("click", () => load((input?.value || "").trim()));
  if (input) input.addEventListener("keypress", (e) => { if (e.key === "Enter") load((input.value || "").trim()); });
  if (scan)  scan.addEventListener("click", () => load(""));

  load(""); // 첫 로드
});
