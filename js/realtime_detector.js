// /js/realtime_detector.js
import { onTicker, setCodes } from "./upbit_ws.js";

// 감시할 마켓들 (원하면 ETH, SOL 등 추가)
setCodes(["KRW-BTC","KRW-ETH","KRW-SOL","KRW-XRP","KRW-ADA"]);

const windowMs = 60 * 1000; // 60초 창
const store = new Map();    // code -> {ticks: [{ts,price}], lastCat:null}

function pushTick(code, price, ts) {
  let s = store.get(code);
  if (!s) { s = { ticks: [], lastCat: null }; store.set(code, s); }
  s.ticks.push({ ts, price });
  // 윈도우 밖 제거
  const from = ts - windowMs;
  while (s.ticks.length && s.ticks[0].ts < from) s.ticks.shift();
  return s;
}

function classify(s) {
  if (s.ticks.length < 2) return null;
  const first = s.ticks[0].price;
  const last  = s.ticks[s.ticks.length - 1].price;
  const chg = ((last - first) / first) * 100; // %
  if (chg >= 3) return "soaring";     // 급등
  if (chg >= 1) return "warming";     // 예열
  if (chg <= -2) return "heating";    // 가열(과열 조정)
  return null;
}

export function startRealtimeDetector(render) {
  const sets = { soaring: new Set(), warming: new Set(), heating: new Set() };

  onTicker(({ code, price, ts }) => {
    const s = pushTick(code, price, ts);
    const cat = classify(s);
    if (cat && cat !== s.lastCat) {
      // 카테고리 이동 처리
      ["soaring","warming","heating"].forEach(k => sets[k].delete(code));
      sets[cat].add(code);
      s.lastCat = cat;
      render({
        soaring: [...sets.soaring],
        warming: [...sets.warming],
        heating: [...sets.heating],
      });
    }
  });
}
