/***********************
 * 검색 로직 (정의만)
 ***********************/

// 유틸
const fmtKRW = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 8 });

// 업비트 마켓 메타 (KRW만)
let MARKET_META = [];

async function fetchMarketMeta() {
  const res = await fetch("/api/market/all");
  if (!res.ok) throw new Error("market/all 요청 실패");
  const all = await res.json();
  MARKET_META = all
    .filter((x) => x.market && x.market.startsWith("KRW-"))
    .map((x) => ({
      market: String(x.market).toUpperCase().trim(),
      korean_name: (x.korean_name || "").trim(),
      english_name: (x.english_name || "").trim(),
    }));
  // 중복 제거
  const seen = new Set();
  MARKET_META = MARKET_META.filter((x) => (seen.has(x.market) ? false : seen.add(x.market)));
  console.log("[search] meta loaded:", MARKET_META.length);
}

async function fetchTickers(markets) {
  if (!markets || markets.length === 0) return [];
  const list = Array.from(new Set(markets)).slice(0, 90); // 안전범위
  const qs = new URLSearchParams({ markets: list.join(",") }).toString();
  const url = `/api/ticker?${qs}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ticker 오류 ${r.status}`);
  return r.json();
}

// 핵심: 검색 실행
async function runSearch(keyword) {
  const $tbody = document.getElementById("result-body");
  const q = (keyword || "").toString().trim();
  if (!$tbody) return;

  if (!q) {
    $tbody.innerHTML = `<tr><td colspan="10" style="text-align:center">검색 결과 없음</td></tr>`;
    return;
  }

  // 메타 없으면 1회 로드
  if (MARKET_META.length === 0) {
    try {
      await fetchMarketMeta();
    } catch (e) {
      console.error(e);
      $tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#f55">마켓 목록 로드 실패</td></tr>`;
      return;
    }
  }

  const norm = q.toLowerCase();
  const matched = MARKET_META.filter((x) => {
    const sym = x.market.replace("KRW-", "");
    return (
      x.korean_name.toLowerCase().includes(norm) ||
      x.english_name.toLowerCase().includes(norm) ||
      x.market.toLowerCase().includes(norm) ||
      sym.toLowerCase().includes(norm)
    );
  });

  if (matched.length === 0) {
    $tbody.innerHTML = `<tr><td colspan="10" style="text-align:center">검색 결과 없음</td></tr>`;
    return;
  }

  const targets = matched.slice(0, 20).map((x) => x.market);

  let tickers = [];
  try {
    tickers = await fetchTickers(targets);
  } catch (e) {
    console.error(e);
    $tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#f55">시세 조회 실패</td></tr>`;
    return;
  }

  const mapMeta = new Map(MARKET_META.map((x) => [x.market, x]));
  const rows = tickers.map((t) => {
    const m = mapMeta.get(t.market) || { korean_name: t.market, english_name: "" };
    const name = `${m.korean_name} (${t.market.replace("KRW-", "")})`;
    const price = t.trade_price ?? 0;
    const chg = (t.signed_change_rate ?? 0) * 100;

    return `
      <tr>
        <td>${name}</td>
        <td style="text-align:right">${fmtKRW.format(price)}원</td>
        <td style="text-align:right">${chg.toFixed(2)}%</td>
        <td>-</td><td>-</td><td>-</td>
        <td>-</td><td>-</td><td>-</td><td>-</td>
      </tr>
    `;
  });

  $tbody.innerHTML = rows.join("");
}

// ✅ 전역 노출 (index.html에서 바인딩용)
window.runSearch = runSearch;
console.log("[search] functions ready");
