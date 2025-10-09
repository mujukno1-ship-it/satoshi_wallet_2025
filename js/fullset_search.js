// fullset_search.js (비모듈, 기존 코드 무변경)
// 검색 → 풀세트 결과(매수/매도/위험도/예열시간/예열종류시간/쩔어결론) 렌더

(function(){
  const API_BASE = "/api/upbit";

  // 엘리먼트
  const $search = document.getElementById("searchInput");
  const $btn    = document.getElementById("searchBtn");
  const $tbody  = document.getElementById("coinsTbody");
  if (!$search || !$btn || !$tbody) return console.warn("[fullset_search] required elements missing");

  // 유틸
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const norm  = (s='') => s.replace(/\s+/g,'').toUpperCase();
  const fmtN  = (n) => Number(n||0).toLocaleString("ko-KR");
  const nowms = () => Date.now();

  // 밴드/시간 추적
  const BAND_START = new Map(); // market -> {band, ts}

  function getBand(ratePct){
    if (ratePct >= 8) return "가열";
    if (ratePct >= 3) return "예열";
    if (ratePct <= -3) return "냉각";
    return "안정";
  }
  function fmtDuration(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const m = Math.floor(s/60);
    const r = s % 60;
    return (m?`${m}분 `:"") + `${r}초`;
  }
  function calcRisk(ratePct, spikePct=0){
    const abs = Math.abs(ratePct) + Math.min(Math.abs(spikePct), 5);
    if (abs < 2)  return 1;
    if (abs < 5)  return 2;
    if (abs < 8)  return 3;
    if (abs < 15) return 4;
    return 5;
  }

  async function upbit(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" }});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function getMarkets() {
    const all = await upbit(`?type=markets`);
    return all.filter(m => m.market?.startsWith("KRW-"));
  }
  async function getTickers(markets) {
    const out = [];
    const CHUNK = 80;
    for (let i = 0; i < markets.length; i += CHUNK) {
      const slice = markets.slice(i, i + CHUNK).join(",");
      const arr = await upbit(`?type=ticker&markets=${encodeURIComponent(slice)}`);
      out.push(...arr);
    }
    return out;
  }

  function renderFullRow(t){
    // 정밀형 타점 (fullset_pro에서 전역 제공)
    const { buy, sell } = (window.calcEntryExitPro ? window.calcEntryExitPro(t) : {
      buy: Math.round(Number(t.trade_price)*0.996),
      sell: Math.round(Number(t.trade_price)*1.004)
    });

    const price   = Number(t.trade_price)||0;
    const ratePct = Number(t.signed_change_rate||0)*100;

    const market = t.market;
    const band   = getBand(ratePct);
    const prev   = BAND_START.get(market);
    const now    = nowms();
    if (!prev || prev.band !== band) BAND_START.set(market, { band, ts: now });

    const bandInfo = BAND_START.get(market);
    const bandDur  = bandInfo ? now - bandInfo.ts : 0;

    const risk = calcRisk(ratePct, 0);
    let zz = "관망";
    if (band === "예열" && risk <= 2 && ratePct >= 3) zz = "단기상승(매수)";
    if (band === "가열" && risk >= 4) zz = "익절권";
    if (band === "냉각" && risk >= 3) zz = "진입주의";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${market.replace("KRW-","")}</td>
      <td>${fmtN(price)}</td>
      <td>${fmtN(buy)}</td>
      <td>${fmtN(sell)}</td>
      <td>${risk}</td>
      <td>${fmtDuration(Math.max(0, now - (bandInfo?.ts || now)))}</td>
      <td>${band} · ${fmtDuration(bandDur)}</td>
      <td>${zz}</td>
    `;
    return tr;
  }

  async function doSearchFullset(){
    const q = norm($search.value||"");
    if (!q) return;

    // 1) 마켓 필터
    const markets = await getMarkets();
    const matched = markets.filter(m => {
      const code = (m.market||"").toUpperCase();
      const base = code.split('-')[1] || "";
      const kor  = (m.korean_name||"").toUpperCase();
      const eng  = (m.english_name||"").toUpperCase();
      return code.includes(q) || base.includes(q) || kor.includes(q) || eng.includes(q);
    });

    const codes = (matched.length ? matched : markets.filter(m=>m.market==="KRW-BTC"))
      .slice(0, 8) // 한 번에 최대 8종
      .map(m => m.market);

    // 2) 티커 수집 → 렌더
    const tickers = await getTickers(codes);
    $tbody.innerHTML = "";
    tickers.forEach(t => $tbody.appendChild(renderFullRow(t)));

    // 3) 잠시 고정(메인 폴링과 충돌 최소화)
    window.__FULLSET_SEARCH_LOCK_UNTIL__ = Date.now() + 8000;
    setTimeout(()=>{ window.__FULLSET_SEARCH_LOCK_UNTIL__ = 0; }, 8000);
  }

  $btn.addEventListener("click", doSearchFullset);
  $search.addEventListener("keydown", e => { if (e.key === "Enter") doSearchFullset(); });
})();
