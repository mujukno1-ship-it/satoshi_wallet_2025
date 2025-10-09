// ✅ 업비트 데이터 가져오기 (fetchJSON)
async function fetchJSON(url) {
  const res = await fetch(url);
  return await res.json();
}

// ✅ tickers 오류 수정 포함
async function load() {
  try {
    const data = await fetchJSON("/api/tickers");

    // ✅ tickers 배열/객체 혼용 오류 방지
    const tickers = Array.isArray(data.tickers)
      ? data.tickers
      : Object.values(data.tickers || {});
    window.tickers = tickers;

    // ✅ 스파이크/예열/메인테이블 렌더링
    renderSpikeSets(data.spikes || []);
    renderWarmCoins(tickers);
    renderMainTable(data.rows || []);

    document.getElementById("zz-upbit-ts").innerText = "✅ 업데이트 완료";
  } catch (e) {
    // ✅ 오류 발생 시 표가 멈추지 않게 표시
    const tbody = document.getElementById("mainTbody");
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="12">⚠️ 스캔 실패: ${e.message}</td></tr>`;
    console.error("⚠️ 로딩 오류:", e);
  }
}

// 🔥 예열 코인 표시
function renderWarmCoins(list) {
  const warmDiv = document.getElementById("warmCoins");
  if (!warmDiv) return;
  warmDiv.innerHTML = list
    .map(
      (c) => `
      <div class="coin-item">
        <span class="name">${c.namekr}</span>
        <span class="price">${c.now}</span>
        <span class="warn">${c.warnState}</span>
      </div>`
    )
    .join("");
}

// 💥 급등/급락 코인 표시
function renderSpikeSets(list) {
  const spikeDiv = document.getElementById("spikeSets");
  if (!spikeDiv) return;
  spikeDiv.innerHTML = list
    .map(
      (s) => `
      <div class="spike-item">
        <span>${s.symbol}</span> <b>${s.change}%</b>
      </div>`
    )
    .join("");
}

// 📊 메인 테이블 표시
function renderMainTable(rows) {
  const tbody = document.getElementById("mainTbody");
  if (!tbody) return;
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${r.namekr}</td>
        <td>${r.now}</td>
        <td>${r.buy1}</td>
        <td>${r.sell1}</td>
        <td>${r.state}</td>
      </tr>`
    )
    .join("");
}

// 🚀 페이지 로드 시 자동 실행
window.addEventListener("DOMContentLoaded", load);
