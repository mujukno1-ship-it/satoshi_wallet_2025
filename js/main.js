// js/main.js
// 화면: 검색창 + 테이블 “로딩 중…” 해제 + 현재가/매수1/매도1 채우기
import { getKRWMarkets, getTickers } from "../integrations/upbit/public.js";

// DOM 훅
const $search = document.querySelector("#searchInput");
const $btn = document.querySelector("#searchBtn");
const $tbody = document.querySelector("#coinsTbody");
const $loadingRow = document.querySelector("#loadingRow");

let ALL_MARKETS = [];      // KRW- 전체 마켓 (KRW-BTC, KRW-ETH ...)
let POLL_TIMER = null;     // 폴링 핸들러
let CURRENT_VIEW = [];     // 현재 테이블에 뿌릴 마켓들

// 숫자 포맷 (업비트 소수/호가 느낌)
function fmt(n) {
  try {
    const v = Number(n);
    if (v >= 1000000) return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
    if (v >= 1000) return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
    return v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  } catch {
    return n;
  }
}

// “매수1/매도1” 임시 계산(기본 버전: 현재가 ±0.4%) — 이후 AI 타점으로 교체 가능
function calcEntryExit(price) {
  const p = Number(price);
  const buy1  = p * 0.996;  // -0.4%
  const sell1 = p * 1.004;  // +0.4%
  return {
    buy1:  Math.round(buy1 * 100) / 100,
    sell1: Math.round(sell1 * 100) / 100,
    state: "대기"
  };
}

// 테이블 한 줄 그리기
function rowHTML(t) {
  const { market, trade_price } = t; // market: "KRW-BTC"
  const name = market.replace("KRW-", ""); // 표시는 심플하게
  const { buy1, sell1, state } = calcEntryExit(trade_price);
  return `
    <tr>
      <td>${name}</td>
      <td>${fmt(trade_price)}</td>
      <td>${fmt(buy1)}</td>
      <td>${fmt(sell1)}</td>
      <td>${state}</td>
    </tr>
  `;
}

// 테이블 그리기
function renderTable(tickers) {
  if ($loadingRow) $loadingRow.style.display = "none";
  if (!tickers || tickers.length === 0) {
    $tbody.innerHTML = `<tr><td colspan="5">데이터 없음</td></tr>`;
    return;
  }
  $tbody.innerHTML = tickers.map(rowHTML).join("");
}

// 업비트에서 데이터 가져와 테이블 반영
async function pullAndRender() {
  try {
    const tickers = await getTickers(CURRENT_VIEW);
    renderTable(tickers);
  } catch (e) {
    console.error("업비트 폴링 오류:", e);
  }
}

// 검색 실행 (한글/영문 모두)
function doSearch() {
  const q = ($search.value || "").trim().toUpperCase();
  if (!q) {
    CURRENT_VIEW = ALL_MARKETS.slice(0, 20); // 기본: 상위 20개만 보여주기
  } else {
    CURRENT_VIEW = ALL_MARKETS
      .filter(m => m.market.includes(q) || (m.korean_name && m.korean_name.includes(q)));
    // 아무것도 없으면 KRW-BTC라도
    if (CURRENT_VIEW.length === 0) CURRENT_VIEW = ALL_MARKETS.filter(m => m.market === "KRW-BTC");
  }
  CURRENT_VIEW = CURRENT_VIEW.map(m => m.market); // "KRW-BTC" 배열로 치환
  pullAndRender();
}

// 초기화
async function init() {
  try {
    const markets = await getKRWMarkets(); // [{market:"KRW-BTC", korean_name:"비트코인", ...}]
    ALL_MARKETS = markets;

    // 최초 화면: BTC만 보여주기(가볍게)
    CURRENT_VIEW = ["KRW-BTC"];
    pullAndRender();

    // 1초 폴링
    if (POLL_TIMER) clearInterval(POLL_TIMER);
    POLL_TIMER = setInterval(pullAndRender, 1000);

    // 이벤트
    $btn.addEventListener("click", doSearch);
    $search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
  } catch (e) {
    console.error("초기화 오류:", e);
  }
}

init();
