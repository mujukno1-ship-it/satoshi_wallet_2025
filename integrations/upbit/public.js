// integrations/upbit/public.js
// 업비트 퍼블릭(무료) API 전용: KRW 마켓 조회 + 틱커(현재가) 조회
// 브라우저에서 직접 호출(키 불필요). 1초 간격 폴링 안정화.

// 공통 fetch 래퍼 (에러/타임아웃 방어)
async function safeFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 8000); // 8초 타임아웃
  try {
    const res = await fetch(url, { signal: ctrl.signal, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

// 1) KRW-마켓 전부 가져오기
export async function getKRWMarkets() {
  const data = await safeFetch("https://api.upbit.com/v1/market/all?isDetails=false");
  return data.filter(m => m.market.startsWith("KRW-"));
}

// 2) 지정한 마켓들의 현재가 일괄 조회 (최대 100개씩 청크 처리)
export async function getTickers(markets) {
  if (!markets || markets.length === 0) return [];
  const out = [];
  const chunkSize = 100; // 업비트 티커 다건 조회 안전 청크
  for (let i = 0; i < markets.length; i += chunkSize) {
    const chunk = markets.slice(i, i + chunkSize);
    const url = "https://api.upbit.com/v1/ticker?markets=" + encodeURIComponent(chunk.join(","));
    const json = await safeFetch(url);
    out.push(...json);
  }
  return out;
}

// 3) (선택) 호가창 상위 15호가 가져오기 — 필요 시 테이블에 붙이면 됨
export async function getOrderbook(markets) {
  if (!markets || markets.length === 0) return [];
  const url = "https://api.upbit.com/v1/orderbook?markets=" + encodeURIComponent(markets.join(","));
  return await safeFetch(url);
}
