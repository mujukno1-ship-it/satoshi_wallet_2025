// fullset_pro.js  (기존 main.js는 건드리지 않음)
// 표의 "매수/매도" 칸만 ATR+VWAP+CVD 기반으로 부드럽게 덮어쓰기

(function(){
  const API_BASE = "/api/upbit";

  // 유틸
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  const $tbody = qs("#coinsTbody");
  if (!$tbody) console.warn("[fullset_pro] coinsTbody not found");

  async function upbit(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" }});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
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

  // ───────── 정밀형 타점(ATR + VWAP + CVD 의사값) ─────────
  function calcEntryExitPro(t) {
    const price = Number(t.trade_price) || 0;
    const high  = Number(t.high_price  ?? price);
    const low   = Number(t.low_price   ?? price);
    const vol   = Number(t.acc_trade_volume_24h ?? 1);

    const atr  = Math.max(1, (high - low) * 0.5);             // ATR 근사
    const vwap = (price * vol) / (vol + 1);                   // VWAP 근사
    const ratePct = Number(t.signed_change_rate || 0) * 100;  // 상승률(%)
    const cvdBias = Math.tanh(ratePct / 10);                  // -1 ~ +1

    const zone = atr * (0.25 + Math.abs(cvdBias) * 0.15);     // 0.25~0.40 ATR
    const adj  = 1 + (cvdBias * 0.02);                        // ±2% 가중

    const buy  = Math.round(Math.max(vwap - zone, low)  * adj);
    const sell = Math.round(Math.min(vwap + zone, high) * adj);

    return { buy, sell, vwap: Math.round(vwap), atr: Math.round(atr), bias: cvdBias.toFixed(2) };
  }

  // 전역 노출(검색 애드온이 재사용)
  window.calcEntryExitPro = calcEntryExitPro;

  function applyToTable(tickers) {
    if (!$tbody) return;
    const byMarket = new Map(tickers.map(t => [t.market, t]));

    qsa("#coinsTbody tr").forEach(tr => {
      const first = tr.children?.[0];
      if (!first) return;
      const name = first.textContent?.trim();      // ex) BTC
      const market = `KRW-${name}`;
      const t = byMarket.get(market);
      if (!t) return;

      const calc = calcEntryExitPro(t);
      // 테이블 컬럼 가정: 0=코인명, 1=현재가, 2=매수, 3=매도
      const tdBuy  = tr.children?.[2];
      const tdSell = tr.children?.[3];
      if (tdBuy)  tdBuy.textContent  = (calc.buy ).toLocaleString("ko-KR");
      if (tdSell) tdSell.textContent = (calc.sell).toLocaleString("ko-KR");
    });
  }

  async function loop() {
    try {
      // 현재 화면에 표시된 코인만 최소 조회
      const names = qsa("#coinsTbody tr td:first-child").map(td => td.textContent?.trim()).filter(Boolean);
      const markets = names.length ? names.map(n => `KRW-${n}`) : ["KRW-BTC"];
      const tickers = await getTickers(markets);
      applyToTable(tickers);
    } catch (e) {
      console.warn("[fullset_pro] update failed:", e?.message || e);
    } finally {
      await sleep(3000); // 3초마다 갱신
      loop();
    }
  }
  loop();
})();
