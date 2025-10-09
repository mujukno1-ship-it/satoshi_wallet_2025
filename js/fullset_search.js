// js/fullset_search.js
(function(){
  const $q  = (s, r=document) => r.querySelector(s);
  const $qa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => Number(n||0).toLocaleString('ko-KR');
  const now = () => Date.now();

  const $input = $q('#searchInput');
  const $btn   = $q('#searchBtn');
  const $tbody = $q('#coinsTbody');
  if (!$input || !$btn || !$tbody) {
    console.warn('[fullset_search] element missing');
    return;
  }

  async function api(path) {
    const res = await fetch(`/api/upbit${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function getMarketsKRW() {
    const all = await api(`?type=markets`);
    return (all || []).filter(m => (m.market || '').startsWith('KRW-'));
  }
  async function getTickers(markets) {
    const out = [];
    const CHUNK = 80;
    for (let i = 0; i < markets.length; i += CHUNK) {
      const slice = markets.slice(i, i + CHUNK).join(',');
      const arr = await api(`?type=ticker&markets=${encodeURIComponent(slice)}`);
      out.push(...arr);
    }
    return out;
  }

  function band(ratePct) {
    if (ratePct >= 8) return '가열';
    if (ratePct >= 3) return '예열';
    if (ratePct <= -3) return '냉각';
    return '안정';
  }
  function risk(ratePct, spike=0) {
    const abs = Math.abs(ratePct) + Math.min(Math.abs(spike), 5);
    if (abs < 2)  return 1;
    if (abs < 5)  return 2;
    if (abs < 8)  return 3;
    if (abs < 15) return 4;
    return 5;
  }
  const bandStart = new Map(); // market -> {band, ts}
  const dur = (ms)=>{ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60); const r=s%60; return (m?`${m}분 `:'')+`${r}초`; };

  function row(t) {
    const price   = Number(t.trade_price)||0;
    const rpct    = Number(t.signed_change_rate||0)*100;
    const mkt     = t.market;
    const b       = band(rpct);

    const prev = bandStart.get(mkt);
    const n    = now();
    if (!prev || prev.band !== b) bandStart.set(mkt, { band: b, ts: n });
    const st   = bandStart.get(mkt);
    const bz   = st ? n - st.ts : 0;

    // 정밀 타점 엔진 사용(전역)
    const { buy, sell } = (window.calcEntryExitPro ? window.calcEntryExitPro(t) : {
      buy: Math.round(price*0.996), sell: Math.round(price*1.004)
    });

    const r = risk(rpct);
    let zz = '관망';
    if (b === '예열' && r <= 2 && rpct >= 3) zz = '단기상승(매수)';
    if (b === '가열' && r >= 4)               zz = '익절권';
    if (b === '냉각' && r >= 3)               zz = '진입주의';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${mkt.replace('KRW-','')}</td>
      <td>${fmt(price)}</td>
      <td>${fmt(buy)}</td>
      <td>${fmt(sell)}</td>
      <td>${r}</td>
      <td>${dur(Math.max(0, n - (st?.ts || n)))}</td>
      <td>${b} · ${dur(bz)}</td>
      <td>${zz}</td>
    `;
    return tr;
  }

  async function doSearch() {
    const q = ($input.value || '').trim().toUpperCase();
    if (!q) return;

    const markets = await getMarketsKRW();
    const matched = markets.filter(m => {
      const code = (m.market||'').toUpperCase();
      const base = code.split('-')[1] || '';
      const kor  = (m.korean_name||'').toUpperCase();
      const eng  = (m.english_name||'').toUpperCase();
      return code.includes(q) || base.includes(q) || kor.includes(q) || eng.includes(q);
    });

    const codes = (matched.length ? matched : markets.filter(m=>m.market==='KRW-BTC'))
      .slice(0, 8).map(m => m.market);

    const tickers = await getTickers(codes);

    $tbody.innerHTML = '';
    tickers.forEach(t => $tbody.appendChild(row(t)));

    // 8초간 메인 루프와 충돌 방지(검색 결과 고정)
    window.__FULLSET_SEARCH_LOCK_UNTIL__ = Date.now() + 8000;
    setTimeout(() => { window.__FULLSET_SEARCH_LOCK_UNTIL__ = 0; }, 8000);
  }

  $btn.addEventListener('click', doSearch);
  $input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
})();
