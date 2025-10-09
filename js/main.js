/**** ─────────────────────────────────────────────────────────
 *  Satoshi Wallet - main.js (stable paste-in version)
 *  기존기능 유지 + 검색결과/예열 동시표시 + 오류가드 + 안전 이벤트
 *  ───────────────────────────────────────────────────────── */

/* ====== 작은 유틸 ====== */
const $ = (sel) => document.querySelector(sel);
const asArr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);
const fmt = (n) =>
  typeof n === "number" ? n.toLocaleString("ko-KR") : (n ?? "-");

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ====== 동적 섹션 생성 유틸 (검색결과 전용 섹션) ======
   기존 검색 UI(#search-section)는 절대 건드리지 않음 */
function ensureSection(id, title) {
  let sec = document.querySelector(`#${id}`);
  if (!sec) {
    const warmSec = document.querySelector("#warm-section"); // 예열 섹션 앞에 삽입
    sec = document.createElement("section");
    sec.id = id;
    sec.innerHTML = `
      <h2>${title}</h2>
      <div id="${id === "search-results" ? "searchResults" : "warmCoins"}"></div>
    `;
    if (warmSec && warmSec.parentNode) {
      warmSec.parentNode.insertBefore(sec, warmSec);
    }
  } else {
    const h2 = sec.querySelector("h2");
    if (h2) h2.textContent = title;
  }
  return sec;
}

/* ====== 예열/검색 표 렌더러 (타겟 컨테이너 지정 가능) ======
   list 원소 예시:
   { symbol, nameKr, korean_name, now, order:{bid,ask}, targets:{long:{B1,TP1,SL}}, risk, comment, warmState, startTime, endTime }
*/
function renderWarmCoins(list, label = "♨️ 예열/가열 코인", targetId = "warmCoins") {
  const wrap = $("#warm-section"); // 섹션 제목 갱신용(있다면)
  const warm = document.querySelector(`#${targetId}`);
  if (!warm) return;

  if (wrap) {
    const h2 = wrap.querySelector("h2");
    if (h2 && targetId === "warmCoins") h2.textContent = label;
  }

  const arr = asArr(list);

  const rowsHTML = arr.length
    ? arr
        .map((c) => {
          const name =
            c.nameKr || c.korean_name || c.symbol?.replace("KRW-", "") || "-";
          const sym = c.symbol || "-";
          const now = c.now ?? c.trade_price ?? "-";

          const bid = c.order?.bid ?? "-";
          const ask = c.order?.ask ?? "-";

          const B1 = c.targets?.long?.B1 ?? "-";
          const TP1 = c.targets?.long?.TP1 ?? "-";
          const SL = c.targets?.long?.SL ?? "-";

          const risk = c.risk ?? 0;
          const dots = "●●●●●".slice(0, risk) + "○○○○○".slice(risk);
          const comment = c.comment || "-";
          const st = c.warmState || "-";
          const stime = c.startTime
            ? new Date(c.startTime).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";
          const etime = c.endTime
            ? new Date(c.endTime).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          return `
            <tr data-symbol="${sym}">
              <td>${name} <small class="muted">${
            sym ? "(" + sym.replace("KRW-", "") + ")" : ""
          }</small></td>
              <td class="right">${fmt(now)}</td>
              <td class="right">${fmt(bid)}</td>
              <td class="right">${fmt(ask)}</td>
              <td class="right">${fmt(B1)}</td>
              <td class="right">${fmt(TP1)}</td>
              <td class="right">${fmt(SL)}</td>
              <td class="center" title="위험도 ${risk}/5">${dots.slice(0, 5)}</td>
              <td>${comment}</td>
              <td class="center">${stime}</td>
              <td class="center">${etime}</td>
              <td>${st}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="12" class="muted">표시할 데이터가 없습니다.</td></tr>`;

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
}

/* ====== 메인 로드/검색 ======
   renderSpikeSets / renderMainTable 는 기존 파일에 이미 존재한다고 가정 */
async function load(q = "") {
  try {
    // 상단 상태 텍스트
    const ts = $("#zz-upbit-ts");
    if (ts) {
      ts.classList.add("muted");
      ts.textContent = "📈 데이터 갱신 중…";
    }
    $("#errorMsg")?.classList.add("hidden");

    // API 호출 (검색어 유무에 따라 분기)
    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";

    let data;
    try {
      data = await fetchJSON(url);
    } catch (e) {
      // 네트워크/서버 오류 시 표에 표시하고 종료
      const tbody = $("#mainTbody");
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="12">⚠️ 로딩 실패: ${
          e.message || e
        }</td></tr>`;
      if (ts) {
        ts.textContent = "⚠️ 네트워크 오류로 데이터 갱신 실패";
        ts.classList.remove("muted");
      }
      console.error(e);
      return;
    }

    // tickers 보조 저장(디버깅/확장용)
    const tickers = asArr(data.tickers);
    window.tickers = tickers;

    // 🔥 급등/급락 세트(기존 기능)
    if (typeof renderSpikeSets === "function") {
      renderSpikeSets(data.spikes || {});
    }

    // 🔍 검색결과 + ♨️ 예열코인 동시 표시 (기존 검색 UI 유지)
    const hasQuery = !!q;
    if (hasQuery) {
      // (a) 검색결과 섹션(동적) 렌더
      ensureSection("search-results", "🔍 검색 결과");
      renderWarmCoins(data.rows || [], "🔍 검색 결과", "searchResults");

      // (b) 예열/가열은 전체 기준으로 다시 그리기
      try {
        const base = await fetchJSON("/api/tickers");
        renderWarmCoins(base.rows || [], "♨️ 예열/가열 코인", "warmCoins");
      } catch {
        // 실패해도 화면 유지
      }
    } else {
      // 검색이 없으면 동적 검색결과 섹션 제거, 예열만 표시
      const s = document.querySelector("#search-results");
      if (s) s.remove();
      renderWarmCoins(data.rows || [], "♨️ 예열/가열 코인", "warmCoins");
    }

    // 하단 메인 테이블(기존 기능)
    if (typeof renderMainTable === "function") {
      renderMainTable(data.rows || []);
    }

    // 업데이트 시간 표시(기존 기능)
    if (ts) {
      const t = new Date(data.updatedAt || Date.now());
      ts.textContent =
        "✅ 업데이트 완료 " +
        t.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      ts.classList.remove("muted");
    }
  } catch (e) {
    // 예외 가드
    const tbody = $("#mainTbody");
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${
        e.message || e
      }</td></tr>`;
    const err = $("#errorMsg");
    if (err) {
      err.textContent = `⚠️ ${e.message || e}`;
      err.classList.remove("hidden");
    }
    console.error(e);
  }
}

/* ====== 초기 이벤트 연결(안전 가드) ====== */
document.addEventListener("DOMContentLoaded", () => {
  const input = $("#search");
  const btn = $("#search-btn");
  const scan = $("#scan-btn");

  if (btn)
    btn.addEventListener("click", () =>
      load((input?.value || "").trim())
    );
  if (input)
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") load((input.value || "").trim());
    });
  if (scan) scan.addEventListener("click", () => load(""));

  // 초기 1회 로드
  load("");
});
