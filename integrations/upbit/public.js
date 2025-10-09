// integrations/upbit/public.js
const API = '/api/upbit';

async function upbit(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// KRW 마켓 목록
export async function getKRWMarkets() {
  const all = await upbit(`?type=markets`);
  return (all || []).filter(m => (m.market || '').startsWith('KRW-'));
}

// 티커(여럿도 지원)
export async function getTickers(marketsCsv) {
  const out = [];
  const list = marketsCsv.split(',').map(s => s.trim()).filter(Boolean);
  const CHUNK = 80;
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK).join(',');
    const arr = await upbit(`?type=ticker&markets=${encodeURIComponent(slice)}`);
    out.push(...arr);
  }
  return out;
}
