// /js/realtime_detector.js
// 예열은 시작되면 "끝날 때"까지 유지되도록 상태머신 + 히스테리시스 적용
// - warm_on(진입)과 warm_off(이탈) 임계값을 다르게 해서 깜빡임 방지
// - warm_off 아래로 연속 COOLDOWN_MS 초 동안 유지되어야 예열 종료 확정
// - 급등으로 가면 예열에서 제거되어 급등 목록으로 이동

import { onTicker, setCodes } from "./upbit_ws.js";

// 감시 마켓 (원하면 추가/삭제)
setCodes(["KRW-BTC","KRW-ETH","KRW-SOL","KRW-XRP","KRW-ADA"]);

// 변화율 계산 구간(슬라이딩 윈도우)
const WINDOW_MS       = 60 * 1000;   // 60초
// 임계값 (히스테리시스: 진입(th_on)과 이탈(th_off)을 다르게)
const SOAR_ON         = 3.0;         // 급등 진입: +3% 이상
const WARM_ON         = 1.0;         // 예열 진입: +1% 이상
const WARM_OFF        = 0.6;         // 예열 이탈: +0.6% 미만으로 내려가면 '종료 후보'
const HEAT_ON         = -2.0;        // 가열(조정): -2% 이하
// 종료 확정 대기시간(예열 종료를 확실히 판정하기 위한 연속 시간)
const COOLDOWN_MS     = 20 * 1000;   // 20초 연속 WARM_OFF 미만일 때 예열 종료
// 틱이 아예 안 들어오면 정리
const STALE_TIMEOUT   = 120 * 1000;  // 120초 무틱 → 목록에서 제거

// 코드별 상태 저장
// code -> {
//   ticks: [{ts, price}], 
//   state: "none"|"warming"|"soaring"|"heating",
//   warmBelowSince: number|null, // 예열 상태에서 warm_off 아래로 내려간 '시작 시각'
//   lastTickTs: number
// }
const store = new Map();

function pushTick(code, price, ts) {
  let s = store.get(code);
  if (!s) {
    s = { ticks: [], state: "none", warmBelowSince: null, lastTickTs: ts };
    store.set(code, s);
  }
  s.ticks.push({ ts, price });
  s.lastTickTs = ts;

  // 윈도우 밖 제거
  const from = ts - WINDOW_MS;
  while (s.ticks.length && s.ticks[0].ts < from) s.ticks.shift();

  return s;
}

function currentChangePct(s) {
  if (!s || s.ticks.length < 2) return 0;
  const first = s.ticks[0].price;
  const last  = s.ticks[s.ticks.length - 1].price;
  if (!first) return 0;
  return ((last - first) / first) * 100.0;
}

export function startRealtimeDetector(render) {
  const sets = {
    soaring: new Set(),
    warming: new Set(),
    heating: new Set(),
  };

  function enter(cat, code) {
    // 카테고리 단일 선택
    ["soaring","warming","heating"].forEach(k => sets[k].delete(code));
    sets[cat].add(code);
  }

  function leaveAll(code) {
    ["soaring","warming","heating"].forEach(k => sets[k].delete(code));
  }

  function paint() {
    render({
      soaring: [...sets.soaring],
      warming: [...sets.warming],
      heating: [...sets.heating],
    });
  }

  onTicker(({ code, price, ts }) => {
    const s = pushTick(code, price, ts);
    const chg = currentChangePct(s);

    switch (s.state) {
      case "none": {
        if (chg >= SOAR_ON) {
          s.state = "soaring";
          s.warmBelowSince = null;
          enter("soaring", code);
          paint();
        } else if (chg >= WARM_ON) {
          s.state = "warming";
          s.warmBelowSince = null;
          enter("warming", code);
          paint();
        } else if (chg <= HEAT_ON) {
          s.state = "heating";
          s.warmBelowSince = null;
          enter("heating", code);
          paint();
        }
        break;
      }
      case "warming": {
        // 급등으로 승격
        if (chg >= SOAR_ON) {
          s.state = "soaring";
          s.warmBelowSince = null;
          enter("soaring", code);   // 예열에서 제거 후 급등으로 이동
          paint();
          break;
        }
        // 예열 유지 (warm_off 이상이면 정상 유지)
        if (chg >= WARM_OFF) {
          s.warmBelowSince = null;  // 이탈 후보 초기화
          // 목록에 없으면 추가 (안전장치)
          if (!sets.warming.has(code)) { enter("warming", code); paint(); }
          break;
        }
        // 예열 이탈 후보: warm_off 미만으로 내려간 시간 누적
        if (s.warmBelowSince == null) {
          s.warmBelowSince = ts;
        }
        // 연속 COOLDOWN_MS 동안 warm_off 미만이면 '예열 종료'
        if (ts - s.warmBelowSince >= COOLDOWN_MS) {
          s.state = "none";
          s.warmBelowSince = null;
          leaveAll(code);
          paint();
        }
        break;
      }
      case "soaring": {
        // 급등은 조건이 깨지면 바로 none으로 내리기보다, 가열로 내려갈 수도 있음
        if (chg <= HEAT_ON) {
          s.state = "heating";
          enter("heating", code);
          paint();
        } else if (chg < WARM_ON) {
          // 급등이 끝나고 충분히 식었다면 제거
          s.state = "none";
          leaveAll(code);
          paint();
        } else if (chg >= WARM_ON && chg < SOAR_ON) {
          // 급등 → 예열로 완화 이동
          s.state = "warming";
          s.warmBelowSince = null;
          enter("warming", code);
          paint();
        }
        break;
      }
      case "heating": {
        // 가열이 해소되면 상태 조정
        if (chg >= SOAR_ON) {
          s.state = "soaring";
          enter("soaring", code);
          paint();
        } else if (chg >= WARM_ON && chg < SOAR_ON) {
          s.state = "warming";
          s.warmBelowSince = null;
          enter("warming", code);
          paint();
        } else if (chg > HEAT_ON) {
          // 가열이 완화되었고 예열도 아니면 제거
          s.state = "none";
          leaveAll(code);
          paint();
        }
        break;
      }
    }
  });

  // 틱이 끊겼을 때 정리 (목록 청소)
  setInterval(() => {
    const now = Date.now();
    for (const [code, s] of store) {
      if (now - s.lastTickTs >= STALE_TIMEOUT) {
        s.state = "none";
        s.warmBelowSince = null;
        store.delete(code);
        leaveAll(code);
      }
    }
    paint();
  }, 5000);
}
