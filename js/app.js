// ↓ 1) KRW-티커만 골라내고, 글자 규칙에 안 맞는 건 자동 제외
function validateMarket(m) {
  // KRW-로 시작 + 뒤는 영문/숫자/하이픈 금지
  return /^(KRW)-[A-Z0-9]+$/.test(m);
}

// ↓ 2) 배열을 여러 묶음으로 나누기 (요청 한 번에 90개씩 권장)
function chunk(arr, size = 90) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ↓ 3) 마켓 전체 받아서 KRW 전용 티커 리스트 만들기
async function fetchKRWMarkets() {
  const res = await fetch('/api/market/all'); // 서버 라우트가 업비트 /v1/market/all 프록시
  if (!res.ok) throw new Error('market/all 요청 실패');
  const all = await res.json();

  // ex) {market:"KRW-BTC", korean_name:"비트코인", ...}
  const krw = all
    .map(x => x.market?.trim().toUpperCase())
    .filter(Boolean)
    .filter(m => m.startsWith('KRW-'))
    .filter(validateMarket);

  // 중복 제거
  return Array.from(new Set(krw));
}

// ↓ 4) 안전한 방법으로 티커 가격들 가져오기
async function fetchTickers() {
  // 4-1) KRW 티커 목록 확보
  const markets = await fetchKRWMarkets();

  // 혹시 잘못된 값들이 있었다면 콘솔에서 확인
  const invalids = markets.filter(m => !validateMarket(m));
  if (invalids.length) {
    console.warn('제외된 잘못된 티커:', invalids);
  }

  // 4-2) 90개씩 잘라 여러 번 요청
  const chunks = chunk(markets, 90);
  const allResults = [];

  for (const c of chunks) {
    // 절대 직접 인코딩하지 말고 URLSearchParams 사용!
    const qs = new URLSearchParams({ markets: c.join(',') }).toString();
    const url = `/api/ticker?${qs}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error('fetchTickers 오류:', res.status, url);
      // 특정 청크가 문제면 어떤 티커가 원인인지 확인하기 쉽게 로그
      console.error('문제 청크 내용:', c);
      throw new Error(`HTTP ${res.status}`);
    }
    const j = await res.json();
    if (Array.isArray(j)) allResults.push(...j);
  }

  return allResults;
}

// ↓ 5) 주기 폴링 호출부 예시 (기존 pollSpikes에서 사용)
async function pollSpikes() {
  try {
    const data = await fetchTickers();
    // TODO: data로 급등/급락 갱신하는 기존 로직 호출
    updateUIWithTickers(data); // ← 기존 함수명에 맞게 사용
  } catch (e) {
    console.error('pollSpikes 실패:', e);
  } finally {
    // 폴링 주기 (기존 값 유지; 너무 짧으면 과부하)
    setTimeout(pollSpikes, 2000);
  }
}
