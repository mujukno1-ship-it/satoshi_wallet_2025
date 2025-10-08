// /js/main.js — 업비트 실시간 + 예열탐지 + 매수·매도 타점 + 위험도 + 쩔어의 한마디

async function fetchMarkets() {
  const res = await fetch("/api/markets");
  const data = await res.json();
  return data.filter(m => m.market.startsWith("KRW-"));
}

async function fetchTicker(market) {
  const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`);
  const data = await res.json();
  return data[0];
}

function fmtKRW(num) {
  return Number(num).toLocaleString("ko-KR");
}

// =============================
// ✨ 매수·매도 타점 + 위험도 + 예열탐지 + 쩔어의 한마디
// =============================
function analyze(price, changeRate) {
  let buy = "-", sell = "-", risk = 3, msg = "";

  if (changeRate > 0.07) { // 급등 후 과열구간
    sell = (price * 1.02).toFixed(0);
    risk = 4;
    msg = "🔥 과열구간 — 익절 기회 놓치지 마세요.";
  } else if (changeRate > 0.03) { // 상승예열
    buy = (price * 0.98).toFixed(0);
    sell = (price * 1.03).toFixed(0);
    risk = 2;
    msg = "🚀 예열중 — 추세상승 가능성 큼.";
  } else if (changeRate < -0.03) { // 하락중
    buy = (price * 0.97).toFixed(0);
    risk = 3;
    msg = "⚠️ 하락권 — 무리한 진입 자제.";
  } else {
    buy = (price * 0.99).toFixed(0);
    sell = (price * 1.01).toFixed(0);
    risk = 1;
    msg = "✅ 안정구간 — 분할매수 적합.";
  }

  return { buy, sell, risk, msg };
}

// =============================
// ⚙️ 메인 실행
// =============================
async function render() {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='8'>⏳ 코인 불러오는 중...</td></tr>";

  try {
    const markets = await fetchMarkets();
    const selected = markets.slice(0, 15); // 상위 15개만 예열 표시

    tbody.innerHTML = "";

    for (const m of selected) {
      const ticker = await fetchTicker(m.market);
      const price = ticker.trade_price;
      const changeRate = ticker.signed_change_rate;
      const { buy, sell, risk, msg } = analyze(price, changeRate);

      const row = `
        <tr>
          <td>${m.korean_name}</td>
          <td>${fmtKRW(price)}원</td>
          <td>${fmtKRW(buy)}원</td>
          <td>${fmtKRW(sell)}원</td>
          <td>${(changeRate * 100).toFixed(2)}%</td>
          <td>${risk}</td>
          <td>${msg}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan='8'>⚠️ 오류 발생: ${e}</td></tr>`;
  }
}

// 페이지 로드시 실행
window.addEventListener("load", render);
