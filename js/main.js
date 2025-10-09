// ===== 기본 설정 =====
async function fetchJSON(url) {
  const res = await fetch(url);
  return await res.json();
}

// ===== 섹션 생성 유틸 =====
function ensureSection(id, title) {
  // id는 "search-results" 같은 새 섹션만 생성 (기존 검색창은 건드리지 않음)
  let sec = document.querySelector(`#${id}`);
  if (!sec) {
    const warmSec = document.querySelector("#warm-section");
    sec = document.createElement("section");
    sec.id = id;
    sec.innerHTML = `
      <h2>${title}</h2>
      <div id="${id === 'search-results' ? 'searchResults' : 'warmCoins'}"></div>
    `;
    warmSec.parentNode.insertBefore(sec, warmSec);
  } else {
    const h2 = sec.querySelector("h2");
    if (h2) h2.textContent = title;
  }
  return sec;
}

// ===== 예열/검색 동시 표시 함수 =====
function renderWarmCoins(list, label = "♨️ 예열/가열 코인", targetId = "warmCoins") {
  const wrap = $("#warm-section");
  const warm = document.querySelector(`#${targetId}`);
  if (!warm) return;
  warm.innerHTML = list
    .map(
      (v) => `
      <div class="coin-row">
        <span>${v.nameKr || v.symbol}</span>
        <span>${v.now}</span>
        <span>${v.warnState || "-"}</span>
      </div>`
    )
    .join("");
}

// ===== 메인 로드 함수 =====
async function load(q = "") {
  try {
    $("#errorMsg")?.classList.add("hidden");
    const ts = $("#zz-upbit-ts");
    if (ts) {
      ts.classList.add("muted");
      ts.textContent = "📊 데이터 생성 중...";
    }

    const url = q ? `/api/tickers?q=${encodeURIComponent(q)}` : "/api/tickers";
    const data = await fetchJSON(url);

    const tickers = Array.isArray(data.tickers)
      ? data.tickers
      : Object.values(data.tickers || {});
    window.tickers = tickers;

    renderSpikeSets(data.spikes); // 급등/급락 세트

    // 🔍 검색 및 ♨️ 예열 동시 표시
    const hasQuery = !!q;
    if (hasQuery) {
      // 🔍 검색 결과
      ensureSection("search-results", "🔍 검색 결과");
      renderWarmCoins(data.rows || [], "🔍 검색 결과", "searchResults");

      // ♨️ 예열/가열 (전체 기준)
      try {
        const base = await fetchJSON("/api/tickers");
        renderWarmCoins(base.rows || [], "♨️ 예열/가열 코인", "warmCoins");
      } catch {}
    } else {
      // 검색 없으면 검색결과 섹션 삭제
      const s = document.querySelector("#search-results");
      if (s) s.remove();
      const baseRows = data.rows || [];
      renderWarmCoins(baseRows, "♨️ 예열/가열 코인", "warmCoins");
    }

    renderMainTable(data.rows || []);

    // 업데이트 시간 표시
    const txt = `✅ 업데이트 완료 ${new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    if (ts) {
      ts.textContent = txt;
      ts.classList.remove("muted");
    }
  } catch (e) {
    const tbody = $("#mainTbody");
    tbody &&
      (tbody.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${e.message}</td></tr>`);
    const err = $("#errorMsg");
    if (err) {
      err.textContent = `⚠️ ${e.message}`;
      err.classList.remove("hidden");
    }
    console.error(e);
  }
}

// ===== 초기 이벤트 연결 =====
document.addEventListener("DOMContentLoaded", () => {
  const input = $("#search");
  const btn = $("#search-btn");
  const scan = $("#scan-btn");

  btn.addEventListener("click", () => load(input.value.trim()));
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") load(input.value.trim());
  });
  scan.addEventListener("click", () => load(""));
});
