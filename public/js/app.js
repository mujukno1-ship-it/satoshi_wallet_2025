// ===== 설정(원하는 룰로 바꿔도 됩니다) =====
const LEVEL_RULE = {
  buyOffset: -0.004,   // 매수 = 현재가 * (1 + 이 값)  (예: -0.4%)
  sellOffset: 0.008,   // 매도 = 현재가 * (1 + 이 값)  (예: +0.8%)
  stopOffset: -0.02,   // 손절 = 현재가 * (1 + 이 값)  (예: -2%)
  warmupMinutes: 20    // 예열 윈도우(시작~종료 = 현재 시각 기준 20분)
};

// 숫자 표시
const fmt = n => (n==null || isNaN(n) ? '-' : n.toLocaleString('ko-KR'));

// 시간 표시
const fmtTime = ts => {
  try {
    const d = new Date(+ts || ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  } catch { return '-'; }
};

// 현재가 기반의 간단 레벨 생성
function buildLevels(tradePrice) {
  const buy  = tradePrice * (1 + LEVEL_RULE.buyOffset);
  const sell = tradePrice * (1 + LEVEL_RULE.sellOffset);
  const stop = tradePrice * (1 + LEVEL_RULE.stopOffset);

  const start = new Date(Date.now());
  const end   = new Date(start.getTime() + LEVEL_RULE.warmupMinutes * 60 * 1000);

  return { buy, sell, stop, start, end };
}

// 키워드로 마켓 찾기 (한글/영문/심볼/정확 마켓코드 모두 지원)
async function findMarketsByKeyword(keyword) {
  const q = (keyword || '').trim().toLowerCase();
  if (!q) return [];

  const res = await fetch('/api/upbit/market/all');
  const json = await res.json();
  const items = json?.data || [];

  // 정확 마켓코드면 바로 매칭 (예: KRW-BTC, BTC-ETH)
  const exactCode = items.find(x => (x.market||'').toLowerCase() === q);
  if (exactCode) return [exactCode.market];

  // 코리안/영문/마켓코드에 포함되는 것들 매칭
  const hit = items.filter(x => {
    const k = (x.korean_name||'').toLowerCase();
    const e = (x.english_name||'').toLowerCase();
    const m = (x.market||'').toLowerCase();
    return k.includes(q) || e.includes(q) || m.includes(q);
  });

  // 너무 많으면 상위 10개만
  return hit.slice(0, 10).map(x => x.market);
}

// 시세 가져오기
async function fetchTicker(markets) {
  const url = '/api/upbit/ticker?markets=' + encodeURIComponent(markets.join(','));
  const res = await fetch(url);
  const json = await res.json();
  return json?.data || [];
}

// 검색 실행
async function runSearch() {
  const input = document.getElementById('search-input');
  const tbody = document.getElementById('result-body');
  const count = document.getElementById('search-count');

  tbody.innerHTML = '';
  count.textContent = '검색 중…';

  try {
    // 1) 키워드 → 마켓 리스트
    const markets = await findMarketsByKeyword(input.value);
    if (!markets.length) {
      count.textContent = '검색 결과 없음';
      return;
    }

    // 2) 마켓 → 시세
    const ticks = await fetchTicker(markets);

    // 3) 렌더
    const rows = ticks.map(t => {
      const price = t.trade_price;
      const changeRate = (t.change_rate * 100).toFixed(2) + '%';

      const lv = buildLevels(price);

      return `
        <tr>
          <td>${t.market}</td>
          <td style="text-align:right">${fmt(price)}</td>
          <td style="text-align:right">${changeRate}</td>
          <td style="text-align:right">${fmt(Math.round(lv.buy))}</td>
          <td style="text-align:right">${fmt(Math.round(lv.sell))}</td>
          <td style="text-align:right; color:#ff5858">${fmt(Math.round(lv.stop))}</td>
          <td>${fmtTime(lv.start)}</td>
          <td>${fmtTime(lv.end)}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows || '<tr><td colspan="8" style="text-align:center; opacity:.7">검색 결과 없음</td></tr>';
    count.textContent = `검색 결과 ${ticks.length}개`;
  } catch (e) {
    console.error('[search] error', e);
    count.textContent = '오류';
    tbody.innerHTML = `<tr><td colspan="8" style="color:#ff6">검색 중 오류가 발생했어요.</td></tr>`;
  }
}

// DOM 바인딩
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('search-btn');
  const input = document.getElementById('search-input');

  const act = () => runSearch();

  btn.addEventListener('click', act);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') act(); });
  input.addEventListener('input', (() => {
    let t; 
    return () => { clearTimeout(t); t = setTimeout(act, 250); };
  })());
});

// (선택) 외부에서 호출할 수 있게 전역 등록
window.runSearch = runSearch;
