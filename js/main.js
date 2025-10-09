async function fetchJSON(url) {
  const res = await fetch(url);
  return await res.json();
}

// ✅ tickers 오류 수정 포함
async function load() {
  const data = await fetchJSON("/api/tickers");
  const tickers = Array.isArray(data.tickers)
    ? data.tickers
    : Object.values(data.tickers || {});
  window.tickers = tickers;
  renderSpikeSets(data.spikes || {});
  renderWarmCoins(tickers);
  renderMainTable(data.rows || []);
  document.getElementById("zz-upbit-ts").innerText = "📈 업데이트 완료";
}

// ♨️ 예열 코인 표시
function renderWarmCoins(list) {
  const warmDiv = document.getElementById("warmCoins");
  if (!warmDiv) return;
  warmDiv.innerHTML = list
    .slice(0, 10)
    .map(
      (c) => `<div>${c.korean_name || c.market} (${c.trade_price?.toLocaleString()}원)</div>`
    )
    .join("");
}

// 🔥 급등/급락 한세트 표시
function renderSpikeSets(spikes) {
  const upDiv = document.getElementById("spikeUpList");
  const downDiv = document.getElementById("spikeDownList");
  upDiv.innerHTML = (spikes.up || [])
    .map((c) => `<div class="spike-item"><span>${c.symbol}</span><span>${c.change}%</span></div>`)
    .join("") || "<div class='muted'>데이터 없음</div>";
  downDiv.innerHTML = (spikes.down || [])
    .map((c) => `<div class="spike-item"><span>${c.symbol}</span><span>${c.change}%</span></div>`)
    .join("") || "<div class='muted'>데이터 없음</div>";
}

// 📊 메인 테이블
function renderMainTable(rows) {
  const tbody = document.getElementById("mainTbody");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${r.nameKr || r.symbol}</td>
        <td>${r.now?.toLocaleString() || "-"}</td>
        <td>${r.targets?.long?.B1?.toLocaleString() || "-"}</td>
        <td>${r.targets?.long?.TP1?.toLocaleString() || "-"}</td>
        <td>${r.warmState || "-"}</td>
      </tr>`
    )
    .join("");
}

// 🔍 검색 기능
document.getElementById("search-btn").addEventListener("click", () => {
  const keyword = document.getElementById("search").value.trim().toLowerCase();
  if (!keyword || !window.tickers) return;
  const result = window.tickers.filter(
    (t) =>
      t.market.toLowerCase().includes(keyword) ||
      (t.korean_name || "").toLowerCase().includes(keyword)
  );
  renderWarmCoins(result);
});

// 초기 로드 및 자동 새로고침
load();
setInterval(load, 4000);
