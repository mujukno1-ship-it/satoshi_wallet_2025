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

  // 1) 마켓 목록 가져오기
  const markets = await safeFetch(getKRWMarkets, []);
  if (!markets.length) {
    connStatus.textContent = "❌ 업비트 연결 실패 (자동 복구 시도 중)";
    setTimeout(updateData, 3000);
    return;
  }

  // 2) 코드 배열로 변환 후 getTickers에 '배열'로 전달
  const codes = markets.map(m => m.market);       // <-- 핵심!
  connStatus.textContent = "✅ 업비트 연결 안정";

  // 너무 많으면 처음 몇십 개만 (원하면 늘려도 됨)
  const tickers = await safeFetch(() => getTickers(codes.slice(0, 80)), []);
  tableBody.innerHTML = "";

  if (!tickers.length) {
    tableBody.innerHTML = `<tr><td colspan="5">❌ 데이터 없음</td></tr>`;
    return;
  }

  // 표 렌더링
  for (const t of tickers.slice(0, 20)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.market.replace("KRW-", "")}</td>
      <td>${Number(t.trade_price).toLocaleString()}</td>
      <td>${Number(t.bid_price ?? t.trade_price*0.996).toLocaleString()}</td>
      <td>${Number(t.ask_price ?? t.trade_price*1.004).toLocaleString()}</td>
      <td>${(Number(t.signed_change_rate)||0) > 0 ? "🔺상승" : "🔻하락"}</td>
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
<script type="module" src="./js/main.js"></script>
