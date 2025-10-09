// js/fullset_search.js — 기존 기능 유지 + 검색결과 표시 오류 수정

import { getUpbitPrice } from "./upbit.js";

export async function handleSearch(query) {
  const tbody = document.getElementById("resultBody");
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;">검색 중...</td></tr>`;

  if (!query || query.trim() === "") {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;">검색어를 입력하세요.</td></tr>`;
    return;
  }

  try {
    // 🔹 업비트 시세 가져오기
    const market = `KRW-${query.trim().toUpperCase()}`;
    const price = await getUpbitPrice(market);

    if (!price) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#f77;">검색 결과 없음</td></tr>`;
      return;
    }

    // 🔹 결과 표로 출력
    const row = `
      <tr>
        <td>${market}</td>
        <td>${price.toLocaleString()}원</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>1</td>
        <td>예열 중</td>
        <td>-</td>
        <td>관망</td>
      </tr>`;
    tbody.innerHTML = row;
  } catch (e) {
    console.error("검색 오류:", e);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#f77;">검색 오류 발생</td></tr>`;
  }
}

// 🔹 이벤트 연결
const btn = document.getElementById("searchBtn");
const input = document.getElementById("searchInput");
if (btn && input) {
  btn.addEventListener("click", () => handleSearch(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch(input.value);
  });
}
