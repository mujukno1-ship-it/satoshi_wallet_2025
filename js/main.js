// ⚡ 사토시의지갑 – 예열/급등 자동탐지 + 매수·매도·손절·익절 + 검색
const $ = (s) => document.querySelector(s);
const resultBox = $("#zz-upbit-ts");
const tableBody = $("#coin-table-body");
const searchBox = $("#search");
const searchBtn = $("#search-btn");
const scanBtn = $("#scan-btn");

// 마켓 목록 캐시
let MARKETS = [];         // [{market:"KRW-BTC", korean_name:"비트코인", english_name:"Bitcoin"}, ...]
let NAME2MARKET = new Map(); // "비트코인" -> "KRW-BTC", "BTC" -> "KRW-BTC" 등

const fmtKRW = (x) => Number(x).toLocaleString("ko-KR") + " 원";
const nowStr = () => new Date().toLocaleString("ko-KR", {hour12:false});

// ---------------------- 분석 로직 (휴리스틱) ----------------------
function analyze(price, changeRate) {
  // changeRate: -0.034 => -3.4%
  const r = changeRate;
  let buy = "-", sell = "-", sl = "-", tp = "-", risk = 3, note = "📊 관망";

  if (r >= 0.15) { // 15%↑ 급등
    sell = fmtKRW(price * 1.02);
    sl   = fmtKRW(price * 0.97);
    tp   = fmtKRW(price * 1.05);
    risk = 4;
    note = "🔥 단기 급등 — 분할 익절 권장";
  } else if (r >= 0.08) { // 8~15% 급등
    sell = fmtKRW(price * 1.015);
    sl   = fmtKRW(price * 0.985);
    tp   = fmtKRW(price * 1.03);
    risk = 4;
    note = "🚀 가속 구간 — 추격은 소액, 익절 빠르게";
  } else if (r >= 0.02) { // +2~8% 예열
    buy = fmtKRW(price * 0.995);
    sl  = fmtKRW(price * 0.975);
    tp  = fmtKRW(price * 1.02);
    risk= 3;
    note= "🔥 예열 중 — 눌림목 분할 진입 후보";
  } else if (r <= -0.05) { // -5%↓ 급락
    buy = fmtKRW(price * 0.98);
    sl  = fmtKRW(price * 0.96);
    tp  = fmtKRW(price * 1.02);
    risk= 2;
    note= "🩵 저점 매수 후보 — 기술적 반등 가능성";
  } else {
    risk= 3;
    note= "📊 관망 — 변동성 약함";
  }

  return { buy, sell, sl, tp, risk, note };
}

function preheatStatus(r) {
  if (r >= 0.08) return { tag:"급등", cls:"hot" };
  if (r >= 0.02) return { tag:"예열", cls:"pre" };
  if (r >= -0.02) return { tag:"중립", cls:"safe" };
  return { tag:"조정", cls:"safe" };
}

// ---------------------- API ----------------------
async function loadMarkets() {
  const r = await fetch("/api/markets");
  const all = await r.json();
  MARKETS = all.filter(m => m.market.startsWith("KRW-"));
  NAME2MARKET.clear();
  for (const m of MARKETS) {
    NAME2MARKET.set(m.korean_name, m.market);
    NAME2MARKET.set(m.english_name?.toUpperCase?.() || "", m.market);
    NAME2MARKET.set(m.market.replace("KRW-",""), m.market); // 심볼
  }
}

async function loadTickers(markets) {
  const url = "/api/tickers?markets=" + encodeURIComponent(markets.join(","));
  const r = await fetch(url);
  return await r.json(); // [{market, trade_price, signed_change_rate, ...}]
}

// ---------------------- 렌더 ----------------------
function renderRows(rows) {
  tableBody.innerHTML = "";
  for (const row of rows) {
    tableBody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${row.name}</td>
        <td class="right">${fmtKRW(row.price)}</td>
        <td class="right">${row.buy}</td>
        <td class="right">${row.sell}</td>
        <td class="right">${row.sl}</td>
        <td class="right">${row.tp}</td>
        <td class="right"><span class="risk-${row.risk}">${row.risk}</span></td>
        <td><span class="tag ${row.stateCls}">${row.state}</span></td>
        <td>${row.start ?? "-"}</td>
        <td>${row.end ?? "-"}</td>
        <td>${row.note}</td>
      </tr>
    `);
  }
}

// ---------------------- 스캔 로직 ----------------------
async function scanPreheat() {
  try {
    resultBox.textContent = `업데이트: ${nowStr()}`;
    tableBody.innerHTML = `<tr><td colspan="11">⏳ 예열/급등 스캔 중…</td></tr>`;

    const markets = MARKETS.map(m => m.market);
    if (!markets.length) throw new Error("마켓 목록이 비어있음");

    const tickers = await loadTickers(markets);

    // 1) 급등(>=8%) 우선, 2) 없으면 상위 변동률 TOP10, 3) 예열(>=2%) 표시는 tag로
    let picks = tickers
      .filter(t => (t.signed_change_rate || 0) >= 0.08)
      .sort((a,b)=> b.signed_change_rate - a.signed_change_rate)
      .slice(0,10);

    if (!picks.length) {
      picks = tickers
        .sort((a,b)=> Math.abs(b.signed_change_rate||0) - Math.abs(a.signed_change_rate||0))
        .slice(0,10);
    }

    const rows = picks.map(t => {
      const m = MARKETS.find(x => x.market === t.market);
      const name = m?.korean_name || t.market.replace("KRW-","");
      const price = t.trade_price;
      const r = t.signed_change_rate || 0;
      const { buy, sell, sl, tp, risk, note } = analyze(price, r);
      const st = preheatStatus(r);
      // 간단한 예열 시간 추정(실데이터 없으므로 표시용)
      const start = (r >= 0.02) ? new Date(Date.now()-20*60000).toLocaleTimeString("ko-KR",{hour12:false}) : "-";
      const end   = (r >= 0.08) ? new Date(Date.now()+10*60000).toLocaleTimeString("ko-KR",{hour12:false}) : "-";

      return {
        name, price, buy, sell, sl, tp, risk,
        state: st.tag, stateCls: st.cls,
        start, end, note
      };
    });

    renderRows(rows);
  } catch (e) {
    console.error(e);
    tableBody.innerHTML = `<tr><td colspan="11">⚠️ 스캔 실패: ${e.message}</td></tr>`;
  }
}

// ---------------------- 검색 ----------------------
async function onSearch() {
  try {
    const q = (searchBox.value || "").trim();
    if (!q) return;
    const market = NAME2MARKET.get(q) || NAME2MARKET.get(q.toUpperCase());
    if (!market) {
      tableBody.innerHTML = `<tr><td colspan="11">해당 코인을 찾을 수 없습니다: ${q}</td></tr>`;
      return;
    }
    resultBox.textContent = `업데이트: ${nowStr()} (검색: ${q})`;
    tableBody.innerHTML = `<tr><td colspan="11">⏳ ${q} 불러오는 중…</td></tr>`;

    const [t] = await loadTickers([market]);
    if (!t) {
      tableBody.innerHTML = `<tr><td colspan="11">데이터 없음</td></tr>`;
      return;
    }

    const m = MARKETS.find(x => x.market === t.market);
    const name = m?.korean_name || t.market.replace("KRW-","");
    const price = t.trade_price;
    const r = t.signed_change_rate || 0;
    const a = analyze(price, r);
    const st = preheatStatus(r);
    const row = [{
      name, price,
      buy:a.buy, sell:a.sell, sl:a.sl, tp:a.tp, risk:a.risk,
      state:st.tag, stateCls:st.cls,
      start:(r>=0.02)?new Date(Date.now()-15*60000).toLocaleTimeString("ko-KR",{hour12:false}):"-",
      end:(r>=0.08)?new Date(Date.now()+10*60000).toLocaleTimeString("ko-KR",{hour12:false}):"-",
      note:a.note
    }];
    renderRows(row);
  } catch (e) {
    console.error(e);
    tableBody.innerHTML = `<tr><td colspan="11">⚠️ 검색 실패: ${e.message}</td></tr>`;
  }
}

// ---------------------- 초기화 ----------------------
async function init() {
  try {
    await loadMarkets();
    resultBox.textContent = `업데이트: ${nowStr()} (마켓 ${MARKETS.length}개)`;
    await scanPreheat();
    // 자동갱신 60초
    setInterval(scanPreheat, 60_000);
  } catch (e) {
    console.error(e);
    resultBox.textContent = "데이터 초기화 실패";
  }
}

window.addEventListener("load", init);
searchBtn.addEventListener("click", onSearch);
searchBox.addEventListener("keypress", (e)=>{ if(e.key==="Enter") onSearch(); });
scanBtn.addEventListener("click", scanPreheat);
