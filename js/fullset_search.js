// /js/fullset_search.js — 검색(코인명/심볼) 최소 구현
import { getUpbitPrice } from "./upbit.js";

// 한글명/약칭 → 심볼
const NAME_TO_SYMBOL = {
  "비트": "BTC", "비트코인": "BTC", "BTC": "BTC",
  "이더": "ETH", "이더리움": "ETH", "ETH": "ETH",
  "솔": "SOL", "솔라나": "SOL", "SOL": "SOL",
  "리플": "XRP", "XRP": "XRP",
  "시바": "SHIB", "시바이누": "SHIB", "SHIB": "SHIB",
};

const $ = (id) => document.getElementById(id);
const $input = $("searchInput");
const $btn   = $("searchBtn");
const $body  = $("resultBody");

function renderRow(msg, isError = false) {
  $body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:${isError ? '#f77' : 'var(--muted)'};">${msg}</td></tr>`;
}

function toMarket(q) {
  if (!q) return null;
  const sym = NAME_TO_SYMBOL[q.trim().toUpperCase()] || q.trim().toUpperCase();
  return sym.startsWith("KRW-") ? sym : `KRW-${sym}`;
}

async function onSearch() {
  const q = $input.value;
  const market = toMarket(q);
  if (!market) {
    renderRow("검색 결과 없음");
    return;
  }
  $body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);">조회중...</td></tr>`;
  try {
    const price = await getUpbitPrice(market);
    if (price == null) {
      renderRow("검색 결과 없음");
      return;
    }
    const code = market.replace("KRW-","");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>KRW-${code}</td>
      <td>${Number(price).toLocaleString("ko-KR")}</td>
      <td>—</td>
      <td>안정</td>
      <td>1</td>
      <td>0초</td>
      <td>-</td>
      <td>관망</td>
    `;
    $body.innerHTML = "";
    $body.appendChild(tr);
  } catch (e) {
    console.error(e);
    renderRow("검색 실패", true);
  }
}

if ($btn) $btn.addEventListener("click", onSearch);
if ($input) $input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onSearch();
});
