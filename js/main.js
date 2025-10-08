// 💎 사토시의지갑 — 업비트 목록 로드 + 한글검색 + 예열스캔(8%↑) + 타점 + 예열시간 표시

// DOM
const tableBody = document.getElementById("coin-data");
const searchBox  = document.getElementById("search");
const searchBtn  = document.getElementById("search-btn");
const scanBtn    = document.getElementById("scan-btn");

// 유틸
const fmt     = (x) => (typeof x === "number" ? x.toLocaleString("ko-KR") : x);
const fmtTime = (d) => (d ? d.toLocaleTimeString("ko-KR", { hour12: false }) : "-");

// 업비트 마켓 목록 (KRW-만), 예: { market: "KRW-BTC", korean_name: "비트코인", english_name: "Bitcoin" }
let MARKETS = []; // 최초 로딩 후 채워짐

// ① 업비트 목록 로드 (한글 검색에 사용)
async function loadMarkets() {
  const r = await fetch("/api/markets");
  if (!r.ok) throw new Error("markets load failed");
  MARKETS = await r.json();
  // 콘솔 확인용
  console.log("MARKETS loaded:", MARKETS.length, "items");
}

// ② 한글/영문/심볼로 마켓코드 찾기 (우선순위: 한글 → 심볼 → 영문)
function findMarketByName(keyword) {
  const k = keyword.trim().toLowerCase();

  // 한글명
  let m = MARKETS.find(m => m.korean_name.toLowerCase().includes(k) && m.market.startsWith("KRW-"));
  if (m) return m.market;

  // 심볼(예: BTC, ETH)
  m = MARKETS.find(m => m.market.toLowerCase() === ("krw-" + k));
  if (m) return m.market;

  // 영문명
  m = MARKETS.find(m => (m.english_name || "").toLowerCase().includes(k) && m.market.startsWith("KRW-"));
  if (m) return m.market;

  return null;
}

// ③ 티커 불러오기(프록시)
async function getTicker(market) {
  const r = await fetch("/api/upbit?market=" + encodeURIComponent(market));
  if (!r.ok) throw new Error("ticker failed");
  return await r.json(); // { trade_price, signed_change_rate, ... }
}

// ④ 예열윈도우 추정 (간단 룰 기반)
function estimatePreheatWindow({ rsi, volume, trend }) {
  const now = new Date();
  let minutes = 25;
  if (volume >= 1.6) minutes -= 7; else if (volume >= 1.3) minutes -= 4; else if (volume <= 0.9) minutes += 6;
  if (rsi >= 65) minutes -= 5;
  if (rsi <= 35) minutes += 5;
  if (trend >= 2) minutes -= 6; else if (trend === 1) minutes -= 2; else if (trend <= -1) minutes += 4;
  minutes = Math.max(10, Math.min(minutes, 50));

  // 간이 상태 분류: 지금은 signed_change_rate 대신 내부 trend/rsi/volume로 판단
  const preheating = trend > 0 || (rsi >= 40 && rsi <= 60 && volume > 1.2);
  if (preheating) {
    const startOffset = Math.floor(3 + (rsi % 8));
    const start = new Date(now.getTime() - startOffset * 60 * 1000);
    const end   = new Date(start.getTime() + minutes * 60 * 1000);
    return { status: "예열중🔥", start, end };
  }
  if (rsi > 65 && volume > 1.4) {
    const start = new Date(now.getTime() - 15 * 60 * 1000);
    const end   = new Date(now.getTime() + 8  * 60 * 1000);
    return { status: "급등중⚡", start, end };
  }
  return { status: "안정🧊", start: null, end: null };
}

// ⑤ 내부 분석 → 타점/위험도/한마디
function analyze(price) {
  // 간단한 시뮬레이션 입력값 (실전은 지표로 대체)
  const rsi    = 40 + Math.random() * 30;      // 40~70
  const volume = 0.8 + Math.random() * 1.2;    // 0.8~2.0
  const trend  = [-1, 0, 1, 2][Math.floor(Math.random() * 4)]; // 상태 샘플

  let signal, risk, comment;
  if (rsi < 30 && volume > 1.2) {
    signal = "매수"; risk = 2; comment = "세력 매집 포착 — 기술적 반등 임박";
  } else if (rsi > 70 && volume > 1.5) {
    signal = "매도"; risk = 4; comment = "급등 후 조정 가능성 — 분할 익절 권장";
  } else if (trend > 1) {
    signal = "매수"; risk = 3; comment = "세력 돌파 신호 — 단기 상승세 지속";
  } else if (trend < 0) {
    signal = "관망"; risk = 1; comment = "에너지 축적 구간 — 대기 권장";
  } else {
    signal = "관망"; risk = 2; comment = "방향성 탐색 중...";
  }

  const buy  = price * 0.995;
  const sell = price * 1.015;
  const stop = price * 0.985;
  const take = price * 1.03;

  const { status, start, end } = estimatePreheatWindow({ rsi, volume, trend });

  return { buy, sell, stop, take, risk, heat: status, start, end, comment };
}

// ⑥ 테이블 그리기(단일 행)
function renderRow({ name, price, analysis }) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${name}</td>
    <td>${fmt(price)} 원</td>
    <td>${fmt(analysis.buy)}</td>
    <td>${fmt(analysis.sell)}</td>
    <td>${fmt(analysis.stop)}</td>
    <td>${fmt(analysis.take)}</td>
    <td>${analysis.risk}</td>
    <td>${analysis.heat}</td>
    <td>${fmtTime(analysis.start)}</td>
    <td>${fmtTime(analysis.end)}</td>
    <td>${analysis.comment}</td>
  `;
  tableBody.appendChild(tr);
}

// ⑦ 검색 실행: 한글/영문 입력 → 마켓코드 찾기 → 티커 → 분석 → 렌더
async function onSearch() {
  const keyword = searchBox.value.trim();
  if (!keyword) return;

  const market = findMarketByName(keyword);
  tableBody.innerHTML = "";

  if (!market) {
    tableBody.innerHTML = `<tr><td colspan="11">"${keyword}"(을)를 찾지 못했습니다. (KRW마켓 기준)</td></tr>`;
    return;
  }

  try {
    const t = await getTicker(market); // { trade_price, signed_change_rate ... }
    const price = t.trade_price;
    const korean = (MARKETS.find(m => m.market === market) || {}).korean_name || market.replace("KRW-","");
    const analysis = analyze(price);
    renderRow({ name: korean, price, analysis });
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="11">시세 조회 실패: ${String(e)}</td></tr>`;
  }
}

// ⑧ 예열 스캔: KRW-마켓 중 **변동률 +8%** 이상만 찾아서 테이블로
async function onScanPreheat() {
  tableBody.innerHTML = `<tr><td colspan="11">스캔 중... (KRW마켓)</td></tr>`;

  // KRW 마켓 코드들
  const markets = MARKETS.map(m => m.market);

  // Upbit /ticker는 여러 마켓을 쉼표로 묶어 한 번에 호출 가능 → 30개씩 나눠 요청
  const chunk = (arr, n) => arr.reduce((a, _, i) => (i % n ? a : [...a, arr.slice(i, i + n)]), []);
  const chunks = chunk(markets, 30);

  const allTickers = [];
  for (const part of chunks) {
    const r = await fetch("https://api.upbit.com/v1/ticker?markets=" + encodeURIComponent(part.join(",")));
    if (!r.ok) continue;
    const data = await r.json();
    allTickers.push(...data);
  }

  // 변동률 +8% 이상만 필터링
  const hot = allTickers
    .filter(t => (t.signed_change_rate || 0) >= 0.08)
    // 가장 상승률 높은 순
    .sort((a, b) => b.signed_change_rate - a.signed_change_rate)
    .slice(0, 20);

  tableBody.innerHTML = "";

  if (!hot.length) {
    tableBody.innerHTML = `<tr><td colspan="11">현재 예열에 해당하는 (+8%↑) 코인이 없습니다.</td></tr>`;
    return;
  }

  // 표시
  for (const t of hot) {
    const korean = (MARKETS.find(m => m.market === t.market) || {}).korean_name || t.market.replace("KRW-","");
    const price = t.trade_price;
    const analysis = analyze(price); // 내부 분석으로 타점/위험도/예열시간 생성
    renderRow({ name: `${korean} (${(t.signed_change_rate*100).toFixed(2)}%)`, price, analysis });
  }
}

// 이벤트
searchBtn.addEventListener("click", onSearch);
searchBox.addEventListener("keypress", (e) => { if (e.key === "Enter") onSearch(); });
scanBtn?.addEventListener("click", onScanPreheat);

// 초기: 마켓 목록만 불러오기
loadMarkets().catch(err => {
  console.error(err);
  tableBody.innerHTML = `<tr><td colspan="11">업비트 마켓 목록 로드 실패</td></tr>`;
});
