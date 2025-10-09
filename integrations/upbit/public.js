// /integrations/upbit/public.js
const PROXY = "/api/upbit";
const DIRECT = "https://api.upbit.com/v1";

const TIMEOUT_MS = 6000;   // 각 요청 타임아웃
const MAX_TRIES  = 6;      // 총 재시도 횟수(프록시/직접 각각 적용)

const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
const jitter = (ms) => ms + Math.floor(Math.random() * 300);

// 공통 fetch: 타임아웃 + 재시도 + 백오프(+429 대기)
async function robustFetch(url, tries = MAX_TRIES) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const id   = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res  = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" }});
      clearTimeout(id);

      if (res.status === 429) {
        // 과호출: 조금 더 길게 쉼
        await sleep(jitter(800 * Math.pow(2, i)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      return await res.json();
    } catch (e) {
      lastErr = e;
      // 0.5s → 1s → 2s → 4s … (지터 포함)
      await sleep(jitter(500 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function proxyThenDirect(path) {
  // 프록시 우선, 실패 시 직접 호출 폴백
  try { return await robustFetch(`${PROXY}${path}`); }
  catch { return await robustFetch(`${DIRECT}${path}`); }
}

export async function getKRWMarkets() {
  const all = await proxyThenDirect(`/market/all?isDetails=false`);
  return (all || []).filter(m => m.market?.startsWith("KRW-"));
}

export async function getTickers(markets) {
  if (!markets?.length) return [];
  const out = [];
  const CHUNK = 80; // 여유 있게(100 미만)
  for (let i = 0; i < markets.length; i += CHUNK) {
    const slice = markets.slice(i, i + CHUNK).join(",");
    const path  = `/ticker?markets=${encodeURIComponent(slice)}`;
    const arr   = await proxyThenDirect(path);
    out.push(...arr);
  }
  return out;
}

// (선택) 함수 유지: 프론트에서 45초마다 가볍게 호출해 서버리스 웜업 용도
export async function ping() {
  try { await robustFetch(`${PROXY}?type=markets`, 1); } catch {}
}

