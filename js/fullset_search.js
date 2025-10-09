// js/fullset_search.js
import { getUpbitPrice } from "/js/upbit.js";


// 한글명/약칭 → 심볼 매핑
const NAME_TO_SYMBOL = {
  "비트": "BTC", "비트코인": "BTC", "BTC": "BTC",
  "이더": "ETH", "이더리움": "ETH", "ETH": "ETH",
  "솔": "SOL", "솔라나": "SOL", "SOL": "SOL",
  "리플": "XRP", "XRP": "XRP",
  "에이다": "ADA", "ADA": "ADA",
  "시바": "SHIB", "시바이누": "SHIB", "SHIB": "SHIB",
};

const $input = document.getElementById("searchInput");
const $btn   = document.getElementById("searchBtn");
const $tbody = document.getElementById("resultBody");

function render(msg, isError=false) {
  $tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:${isError ? '#f77':'var(--muted)'}">${msg}</td></tr>`;
}

function toMarket(q) {
  if (!q) return null;
  const raw = q.trim().toUpperCase();      // KRW-BTC / BTC
  // 이미 KRW-포맷이면 그대로
  if (/^KRW-[A-Z0-9]+$/.test(raw)) return raw;
  // 한글명 -> 심볼
  const ko = NAME_TO_SYMBOL[q.trim()] || NAME_TO_SYMBOL[raw];
  if (ko) return `KRW-${ko}`;
  // 심볼 그대로 입력(BTC 등)
  if (/^[A-Z0-9]{2,10}$/.test(raw)) return `KRW-${raw}`;
  return null;
}

function renderRow({ market, price }) {
  const p = (price ?? 0).toLocaleString();
  $tbody.innerHTML = `
    <tr>
      <td>${market}</td>
      <td>${p}원</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>1</td>
      <td>-</td>
      <td>-</td>
      <td>관망</td>
    </tr>`;
}

export async function handleSearch(query) {
  if (!$tbody) return;
  if (!query || !query.trim()) { render("검색어를 입력하세요."); return; }

  const market = toMarket(query);
  if (!market) { render("심볼/이름을 정확히 입력하세요 (예: 비트, BTC, KRW-BTC)"); return; }

  render("검색 중...");
  try {
    const price = await getUpbitPrice(market);   // upbit.js의 함수
    if (typeof price === "number") {
      renderRow({ market, price });
    } else {
      render("검색 결과 없음");
    }
  } catch (e) {
    console.error("검색 오류:", e);
    render("API 오류 or 네트워크 오류", true);
  }
}

// 이벤트 연결
if ($btn && $input) {
  $btn.addEventListener("click", () => handleSearch($input.value));
  $input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSearch($input.value); });
} else {
  // ID 불일치 디버그 힌트
  console.warn("searchBtn/searchInput/resultBody ID를 확인하세요.");
}
