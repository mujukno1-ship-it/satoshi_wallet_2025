import { getKRWMarkets, getTickers, ping } from "../integrations/upbit/public.js";

const connStatus = document.getElementById("connStatus");
const tableBody = document.getElementById("coinsTbody");

async function safeFetch(fetchFn, fallback = null, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const data = await fetchFn();
      if (data) return data;
    } catch (err) {
      console.warn(`재시도 ${i + 1}회:`, err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return fallback;
}

async function updateData() {
  connStatus.textContent = "🔄 연결 중…";
  const markets = await safeFetch(getKRWMarkets, []);
  if (!markets.length) {
    connStatus.textContent = "❌ 업비트 연결 실패 (자동 복구 시도 중)";
    setTimeout(updateData, 3000);
    return;
  }

  connStatus.textContent = "✅ 업비트 연결 안정";
  const tickers = await safeFetch(() => getTickers(markets.join(",")), []);

  tableBody.innerHTML = "";
  if (!tickers.length) {
    tableBody.innerHTML = `<tr><td colspan="5">❌ 데이터 없음</td></tr>`;
    return;
  }

  for (const t of tickers.slice(0, 20)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.market.replace("KRW-", "")}</td>
      <td>${Number(t.trade_price).toLocaleString()}</td>
      <td>${Number(t.bid_price).toLocaleString()}</td>
      <td>${Number(t.ask_price).toLocaleString()}</td>
      <td>${t.signed_change_rate > 0 ? "🔺상승" : "🔻하락"}</td>
    `;
    tableBody.appendChild(tr);
  }
}

async function autoPing() {
  const pong = await safeFetch(ping);
  if (!pong) connStatus.textContent = "⚠️ 재연결 중…";
}

setInterval(updateData, 5000); // 5초마다 자동 갱신
setInterval(autoPing, 8000);  // 8초마다 연결 체크
updateData();
