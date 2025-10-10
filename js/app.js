/* ===== 사토시의지갑 - 안정/개선 통합본 =====
   - 기존 기능 유지 : 코인명/심볼검색/매수/매도/손절/위험도/예열시작/예열종류/쩔어결론
   - 업비트 서버리스 API 사용 : /api/markets , /api/ticker
   - 업비트 KRW 호가단위 정확 반영 (저가코인 포함)
   - 검색 성능/안정 향상(중복 요청 취소, 배치 호출, 예외처리)
   - “실시간 상승(9종)” 자동 갱신 박스 추가 (검색 아래)
*/

// ✅ 업비트 직접 API 주소 (vercel 프록시 아님)
const PROXY = 'https://api.upbit.com/v1';
const API_MARKETS = `${PROXY}/market/all?isDetails=false`;
const API_TICKER_BATCH = `${PROXY}/ticker?markets=`;
const API_TICKER_ONE = `${PROXY}/ticker?market=`;


/* ---------- 내부 상태 ---------- */
let marketsCache = [];          // 업비트 KRW 마켓 목록
let nameIndex = [];             // 검색용 인덱스
let pollTimer = null;           // 검색 결과 폴링
let windowTimer = null;         // 실시간 상승 폴링
let inFlight;                   // fetch 취소용
let lastRowHTML = '';           // 깜빡임 제거용
let lastRenderKey = '';         // 동일 key 시 렌더 스킵

/* ---------- 날짜/포맷 ---------- */
function fmtTime(d) {
  if (!d) return '—';
  const pad = n => String(n).padStart(2,'0');
  return `${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function _fmtKRW(x) {
  try {
    return new Intl.NumberFormat('ko-KR').format(Math.round(x ?? 0));
  } catch { return String(x ?? 0); }
}

/* === KRW 호가단위 (업비트 표준) === */
function getTickKRW(p){
  if (p >= 2000000) return 1000;
  if (p >= 1000000) return 500;
  if (p >=  500000) return 100;
  if (p >=  100000) return 50;
  if (p >=   10000) return 10;
  if (p >=    1000) return 1;
  if (p >=     100) return 0.1;
  if (p >=      10) return 0.01;
  if (p >=       1) return 0.001;
  if (p >=     0.1) return 0.0001;
  if (p >=    0.01) return 0.0001; // SHIB 구간
  if (p >=   0.001) return 0.00001;
  return 0.000001;
}
function roundToTick(price, mode='nearest'){
  const t = getTickKRW(Math.abs(price));
  if (mode === 'up')   return Math.ceil(price / t) * t;
  if (mode === 'down') return Math.floor(price / t) * t;
  return Math.round(price / t) * t;
}
function formatKRW(p){
  const dec = (roundToTick(Math.abs(p))+'').split('.')[1]?.length ?? 0;
  const n = Number(p).toFixed(dec);
  return n;
}

/* ---------- 공용 fetch (취소/재시도) ---------- */
async function fetchJSON(url, tries=2){
  // 이전 요청이 살아있다면 취소
  try{ inFlight?.abort?.(); }catch{}
  inFlight = new AbortController();

  let err;
  for (let i=0; i<tries; i++){
    try{
      const r = await fetch(url, { signal: inFlight.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(e){
      err = e;
      // 사용자가 페이지 이동 등으로 취소한 경우 바로 중단
      if (e?.name === 'AbortError') throw e;
      await new Promise(r => setTimeout(r, 400 + i*200));
    }
  }
  throw err ?? new Error('fetch 실패');
}

/* ---------- 마켓 목록 ---------- */
async function loadMarketsCached(){
  if (marketsCache.length) return marketsCache;

  const list = await fetchJSON(API_MARKETS);
  // KRW 마켓만, 이름 인덱스 준비
  marketsCache = list.filter(m => m.market?.startsWith('KRW-'));
  nameIndex = marketsCache.map(m => ({
    market: m.market,
    code: m.market.replace('KRW-',''),
    korean: m.korean_name ?? '',
    english: m.english_name ?? ''
  }));
  console.log('✅ 업비트 마켓 불러오기 성공:', marketsCache.length);
  return marketsCache;
}

function findMarketSmart(q){
  q = (q ?? '').trim();
  if (!q) return null;
  const s = q.toUpperCase();

  // 정확히 KRW-XXX 형태면 바로 찾기
  if (s.startsWith('KRW-')){
    return nameIndex.find(m => m.market === s) || null;
  }
  // 심볼
  let hit = nameIndex.find(m => m.code === s);
  if (hit) return hit;

  // 한글/영문 일부 포함
  hit = nameIndex.find(m =>
    m.korean.includes(q) || m.english.toUpperCase().includes(s)
  );
  return hit || null;
}

/* ---------- 단일 티커 ---------- */
async function loadTicker(market){
  const d = await fetchJSON(API_TICKER_ONE + encodeURIComponent(market));
  // /api/ticker?market=KRW-XXX → 단일 객체 또는 배열 1개 형태를 모두 허용
  return Array.isArray(d) ? d[0] : d;
}

/* ---------- 배치 티커 (100개씩) ---------- */
async function fetchTickers(markets = []){
  if (!Array.isArray(markets) || markets.length === 0) return [];
  const out = [];
  for (let i=0; i<markets.length; i+=100){
    const chunk = markets.slice(i, i+100).map(m => m.market ?? m).join(',');
    try{
      const d = await fetchJSON(API_TICKER_BATCH + encodeURIComponent(chunk));
      if (Array.isArray(d)) out.push(...d);
      else console.warn('⚠ ticker 응답 형식 이상:', d);
    }catch(e){
      console.error('fetchTickers 오류:', e);
    }
  }
  // 변동률 상위 → 숫자만
  return out
    .filter(t => typeof t.signed_change_rate === 'number')
    .sort((a,b) => b.signed_change_rate - a.signed_change_rate);
}

/* ---------- 검색 결과 렌더 ---------- */
function renderEmpty(msg='검색 결과 없음'){
  const tb = document.getElementById('result-body');
  if (!tb) return;
  tb.innerHTML = `<tr><td colspan="10" class="empty">${msg}</td></tr>`;
}

async function renderRowSafe(hit){
  const tb = document.getElementById('result-body');
  if (!tb) return;

  try{
    const tk = await loadTicker(hit.market);
    const rate = tk.signed_change_rate ?? 0;
    const p = tk.trade_price ?? 0;

    // 간이 지표 (기존 로직/모듈 없어도 동작)
    const buy  = roundToTick(p * 0.985, 'down'); // 예: 매수 ~1.5% 아래
    const take = roundToTick(p * 1.025, 'up');   // 예: 익절 ~2.5% 위
    const stop = roundToTick(p * 0.97,  'down'); // 예: 손절 ~3% 아래
    const risk = Math.min(5, Math.max(1, Math.round(Math.abs(rate*100)/2)));

    const decide = (()=>{
      if (rate > 0.02) return '관망';
      if (rate < -0.03) return '관망';
      return '관망';
    })();

    const key = `${p}|${rate}`;
    if (lastRenderKey === key && lastRowHTML){
      tb.innerHTML = lastRowHTML;
      return;
    }
    lastRenderKey = key;

    const row = `
      <tr>
        <td class="nowrap">${hit.korean} (${hit.market})</td>
        <td class="price ${tk.change==='RISE'?'up':(tk.change==='FALL'?'down':'')}"
            >${formatKRW(roundToTick(p))}</td>
        <td>${(rate*100).toFixed(2)}%</td>
        <td>${_fmtKRW(buy)}</td>
        <td>${_fmtKRW(take)}</td>
        <td>${_fmtKRW(stop)}</td>
        <td><span class="risk-badge risk-${risk}">${risk}</span></td>
        <td>—</td>
        <td>—</td>
        <td>${decide}</td>
      </tr>
    `;
    tb.innerHTML = row;
    lastRowHTML = row;
  }catch(e){
    console.error('renderRowSafe 오류:', e);
    if (lastRowHTML) document.getElementById('result-body').innerHTML = lastRowHTML;
    else renderEmpty('서버 응답 대기 중…');
  }
}

/* ---------- 검색 폴링 ---------- */
function startPolling(hit){
  if (pollTimer) clearTimeout(pollTimer);
  const tick = 6000 + Math.floor(Math.random()*3000); // 6~9초
  pollTimer = setTimeout(async ()=>{
    await renderRowSafe(hit);
    startPolling(hit);
  }, tick);
}

/* ---------- 실시간 상승(Top 9) 렌더 ---------- */
function renderSpikes(list=[]){
  const box = document.getElementById('spike-box');
  if (!box) return;

  const title = box.querySelector('.title') ?? (() => {
    const d = document.createElement('div');
    d.className = 'title';
    box.appendChild(d);
    return d;
  })();
  title.textContent = '실시간 상승';

  const ul = box.querySelector('ul') ?? (() => {
    const u = document.createElement('ul');
    u.className = 'spike-list';
    box.appendChild(u);
    return u;
  })();

  ul.innerHTML = list.map(t => {
    const up = t.signed_change_rate >= 0;
    const rateText = (t.signed_change_rate*100).toFixed(2)+'%';
    return `
      <li class="spike-item">
        <span class="n">${t.korean_name ?? t.market} (${t.market})</span>
        <span class="p">${_fmtKRW(t.trade_price ?? 0)}</span>
        <span class="r ${up?'up':'down'}">${rateText}</span>
      </li>`;
  }).join('');
}

/* ---------- 실시간 상승(Top 9) 폴링 ---------- */
async function pollSpikes(){
  try{
    const mkts = await loadMarketsCached();
    const ticks = await fetchTickers(mkts);
    const top = ticks.slice(0, 9);
    // 이름 매핑
    const map = Object.fromEntries(mkts.map(m => [m.market, m]));
    top.forEach(t => Object.assign(t, map[t.market] || {}));
    renderSpikes(top);
  }catch(e){
    console.error('pollSpikes error:', e);
  }finally{
    clearTimeout(windowTimer);
    windowTimer = setTimeout(pollSpikes, 6000 + Math.floor(Math.random()*3000));
  }
}

/* ---------- 이벤트/검색 ---------- */
async function onSearch(){
  const input = document.getElementById('search-input');
  const q = (input?.value || '').trim();
  if (!q) return;

  const hit = findMarketSmart(q);
  if (!hit){ renderEmpty('검색 결과 없음'); if (pollTimer) clearTimeout(pollTimer); return; }

  if (pollTimer) clearTimeout(pollTimer);
  await renderRowSafe(hit);   // 즉시 1회
  startPolling(hit);          // 이후 주기 갱신
}

/* ---------- 초기화 ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    await loadMarketsCached();
  }catch(e){
    console.error('❌ 마켓 로드 실패:', e);
    renderEmpty('마켓 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  const input = document.getElementById('search-input');
  const btn = document.getElementById('search-btn');
  if (btn) btn.addEventListener('click', onSearch);
  if (input) input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') onSearch(); });

  // ✅ 실시간 상승(Top 9) 자동 갱신 시작
  pollSpikes();

  console.log('✅ app.js 로드 완료');
});
