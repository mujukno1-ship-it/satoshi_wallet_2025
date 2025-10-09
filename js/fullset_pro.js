// js/fullset_pro.js
(function(){
  // 안전 헬퍼: 배열/이터러블 변환
const toArr = (v) =>
  Array.isArray(v)
    ? v
    : v && typeof v[Symbol.iterator] === "function"
    ? Array.from(v)
    : [];


  // 안전 헬퍼: 배열/이터러블 변환
  const toArr = (v) =>
    Array.isArray(v)
      ? v
      : v && typeof v[Symbol.iterator] === "function"
      ? Array.from(v)
      : [];

  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise(r=>setTimeout(r, ms));

  
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise(r=>setTimeout(r, ms));

  async function api(path) {
    const res = await fetch(`/api/upbit${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
 async function getTickers(markets) {
  const out = [];
  const CHUNK = 80;

  // markets 자체도 혹시 모를 안전 변환
  const safeMarkets = toArr(markets);

  for (let i = 0; i < safeMarkets.length; i += CHUNK) {
    const slice = safeMarkets.slice(i, i + CHUNK).join(',');
    const raw  = await api(`?type=ticker&markets=${encodeURIComponent(slice)}`);
    const arr  = toArr(raw);          // ← 무조건 배열로 변환
    out.push(...arr);                 // ← 이제 안전하게 전개됨
  }
  return out;
}

    const low   = Number(t.low_price   ?? price);
    const vol   = Number(t.acc_trade_volume_24h ?? 1);

    const atr  = Math.max(1, (high - low) * 0.5);
    const vwap = (price * vol) / (vol + 1);
    const ratePct = Number(t.signed_change_rate || 0) * 100;
    const cvdBias = Math.tanh(ratePct / 10);        // -1 ~ +1

    const zone = atr * (0.25 + Math.abs(cvdBias) * 0.15);
    const adj  = 1 + (cvdBias * 0.02);              // ±2% 가중

    const buy  = Math.round(Math.max(vwap - zone, low)  * adj);
    const sell = Math.round(Math.min(vwap + zone, high) * adj);
    return { buy, sell, vwap: Math.round(vwap), atr: Math.round(atr), bias: cvdBias };
  }

  // 검색 애드온에서 재사용 가능하게 전역 공개
  window.calcEntryExitPro = calcEntryExitPro;

  function applyToTable(tickers) {
    const byMarket = new Map(tickers.map(t => [t.market, t]));
    qsa('#coinsTbody tr').forEach(tr => {
      const first = tr.children?.[0]; if (!first) return;
      const name = (first.textContent || '').trim();
      if (!name) return;
      const t = byMarket.get(`KRW-${name}`);
      if (!t) return;

      const { buy, sell } = calcEntryExitPro(t);
      const tdBuy  = tr.children?.[2];
      const tdSell = tr.children?.[3];
      if (tdBuy)  tdBuy.textContent  = Number(buy ).toLocaleString('ko-KR');
      if (tdSell) tdSell.textContent = Number(sell).toLocaleString('ko-KR');
    });
  }

  async function loop() {
    try {
      const names = qsa('#coinsTbody tr td:first-child')
        .map(td => (td.textContent || '').trim()).filter(Boolean);
      const markets = names.length ? names.map(n => `KRW-${n}`) : ['KRW-BTC'];
      const tickers = await getTickers(markets);
      applyToTable(tickers);
    } catch (e) {
      console.warn('[fullset_pro] update failed:', e?.message || e);
    } finally {
      await sleep(3000);
      loop();
    }
  }
  loop();
})();

