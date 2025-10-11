/* public/js/app.js
 * Upbit 네트워크 전용 검색/표시 스크립트 (중복·오류 제거 버전)
 * - 위험도/예열시간/쩔어한마디 추가
 * - index.html 의 헤더 9칸과 정확히 맞춰 렌더링
 */

/** 유틸 */
const fmt = (n) => {
  if (n == null || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('ko-KR');
};
const fmt2 = (n, d=2) => {
  if (n == null || Number.isNaN(n)) return '-';
  return Number(n).toFixed(d);
};
const pad2 = (v) => (v < 10 ? '0' + v : '' + v);
const fmtTime = (ts) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const da = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${y}-${m}-${da} ${hh}:${mm}:${ss}`;
};

/** 위험도 계산 (변동률 기반 간단 버전) */
function getRisk(changeRate) {
  let text = '저위험', color = '#22c55e'; // green
  if (changeRate > 5) { text = '고위험'; color = '#ef4444'; }         // red
  else if (changeRate > 2) { text = '중간위험'; color = '#f59e0b'; } // amber
  return { text, color };
}

/** ‘쩔어 한마디’ (간단 통계) */
function getZzzComment(ticks) {
  if (!ticks || !ticks.length) return '🪙 검색 결과가 없어요. 다른 코인을 입력해보세요!';
  const avg = ticks
    .map(t => Number(t.signed_change_rate) * 100)
    .filter(v => !Number.isNaN(v))
    .reduce((a,b)=>a+b,0) / ticks.length;

  if (avg > 3)  return '🔥 강한 상승세! 지금은 관망보다 단타 유리!';
  if (avg > 0)  return '📈 완만한 상승 중… 눌림 매수 구간 체크!';
  if (avg > -3) return '🌫 조정 흐름, 급락보단 횡보!';
  return '⚠ 하락 압력 강함, 무리한 진입 금지!';
}

/** Upbit 시장 목록(심볼/국문명) */
async function fetchMarkets() {
  const url = `/api/upbit/market/all`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('시장 목록 조회 실패');
  const j = await r.json();
  return j.data || [];
}

/** 여러 심볼 시세 한번에 */
async function fetchTickers(markets) {
  if (!markets.length) return [];
  const q = encodeURIComponent(markets.join(','));
  const url = `/api/upbit/ticker?markets=${q}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('시세 조회 실패');
  const j = await r.json();
  return j.data || [];
}

/** 행 렌더링 (헤더 9칸과 1:1 매칭) */
function renderRow(t) {
  const price = Number(t.trade_price);
  const changeRate = Number(t.signed_change_rate) * 100;

  // 간단 매수/매도/손절 타점 (예시값)
  const buy  = Math.round(price * 0.997); // -0.3%
  const sell = Math.round(price * 1.003); // +0.3%
  const stop = Math.round(price * 0.98);  // -2%

  const risk = getRisk(changeRate);

  const now = Date.now();
  const lv = {
    start: now + 3 * 60 * 1000, // 3분 뒤 예열시작
    end:   now + 15 * 60 * 1000 // 15분 뒤 예열종료
  };

  const crCls = changeRate > 0 ? 'txt-up' : (changeRate < 0 ? 'txt-down' : '');
  const riskStyle = `background:${risk.color}`;

  return `
    <tr>
      <td>${t.market}</td>
      <td style="text-align:right">${fmt(price)}</td>
      <td class="${crCls}" style="text-align:right">${fmt2(changeRate,2)}%</td>
      <td style="text-align:right">${fmt(buy)}</td>
      <td style="text-align:right">${fmt(sell)}</td>
      <td style="text-align:right">${fmt(stop)}</td>
      <td style="text-align:center">
        <span class="risk" style="${riskStyle}">${risk.text}</span>
      </td>
      <td style="text-align:right">${fmtTime(lv.start)}</td>
      <td style="text-align:right">${fmtTime(lv.end)}</td>
    </tr>
  `.trim();
}

/** 메인 검색 로직 */
async function runSearch() {
  const input = document.getElementById('search-input');
  const tbody = document.getElementById('result-body');
  const statusEl = document.getElementById('search-status');

  const kw = (input.value || '').trim();
  statusEl.textContent = '🔎 검색 중…';
  tbody.innerHTML = '';

  try {
    const markets = await fetchMarkets();

    // 검색 키워드: 국문명/영문명/심볼 또는 "KRW-BTC" 같은 마켓
    const key = kw.toLowerCase();
    let list = markets.filter(m => {
      const kn = (m.korean_name || '').toLowerCase();
      const en = (m.english_name || '').toLowerCase();
      const mk = (m.market || '').toLowerCase();
      return !kw || kn.includes(key) || en.includes(key) || mk.includes(key);
    });

    // 너무 많으면 상위 30개까지만
    list = list.slice(0, 30);

    const marketNames = list.map(m => m.market);
    const ticks = await fetchTickers(marketNames);

    // 쩔어 한마디
    statusEl.textContent = `🗣 쩔어 한마디: ${getZzzComment(ticks)}`;

    // 행 렌더
    if (!ticks.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; opacity:.7">검색 결과 없음</td></tr>`;
      return;
    }
    tbody.innerHTML = ticks.map(renderRow).join('');
  } catch (e) {
    console.error('[search] error', e);
    statusEl.textContent = '❌ 오류가 발생했어요.';
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#fda4af">검색 중 오류가 발생했습니다.</td></tr>`;
  }
}

/** DOM 바인딩 */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('search-btn');
  const input = document.getElementById('search-input');

  const act = () => runSearch();

  btn.addEventListener('click', act);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') act(); });

  // 입력 디바운스(250ms)로 자동 미리검색
  let t = null;
  input.addEventListener('input', () => {
    if (t) clearTimeout(t);
    t = setTimeout(act, 250);
  });

  // 초기 1회
  act();
});
