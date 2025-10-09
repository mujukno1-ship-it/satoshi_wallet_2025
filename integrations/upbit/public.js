// /integrations/upbit/public.js
const PROXY  = "/api/upbit";
const DIRECT = "https://api.upbit.com/v1";

const TIMEOUT_MS = 6000;
const MAX_TRIES  = 6;

const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
const jitter = (ms) => ms + Math.floor(Math.random() * 300);

async function robustFetch(url, tries = MAX_TRIES) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      clearTimeout(id);

      if (res.status === 429) { // 과호출
        await sleep(jitter(800 * Math.pow(2, i)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(jitter(500 * Math.pow(2, i))); // 0.5s -> 1s -> 2s ...
    }
  }
  throw lastErr;
}

async function proxyThenDirect(path) {
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
  const CHUNK = 80;
  for (let i = 0; i < markets.length; i += CHUNK) {
    const slice = markets.slice(i, i + CHUNK).join(",");
    const path  = `/ticker?markets=${encodeURIComponent(slice)}`;
    const arr   = await proxyThenDirect(path);
    out.push(...arr);
  }
  return out;
}

// 서버리스 웜업용(선택)
export async function ping() {
  try { await robustFetch(`${PROXY}?type=markets`, 1); } catch {}
}
