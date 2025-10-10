// /js/realtime_detector.js — 실시간 분류(급등/예열/가열) + WS 실패시 REST 폴백
import { startUpbitRealtime } from "./upbit_ws.js";
import { getTickers } from "./upbit.js";

// 구독할 심볼
const CODES = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-SOL"];

export function startRealtimeDetector(onUpdate) {
  let soaring = [];
  let warning = [];
  let heating = [];
  let stopPolling = null;  // REST 폴링 정리 함수
  let stopWS = null;       // WS 정리 함수

  const flush = (statusText = "") => {
    onUpdate?.({ soaring, warning, heating, statusText });
  };

  const classify = (t) => {
    // t: Upbit ticker object
    const code = t?.market || t?.code;
    if (!code) return;
    const price = Number(t?.trade_price ?? 0);
    const ratePct = Math.round((t?.signed_change_rate ?? 0) * 100);
    const vol = Number(t?.acc_trade_volume_24h ?? 0);

    const label = `${code} : ${price.toLocaleString()}원`;

    const addOrRemove = (arr, cond) => {
      const i = arr.indexOf(label);
      if (cond) {
        if (i < 0) arr.unshift(label);
        if (arr.length > 20) arr.pop();
      } else {
        if (i >= 0) arr.splice(i, 1);
      }
    };

    // 임시 기준
    addOrRemove(soaring, ratePct >= 3);
    addOrRemove(warning, ratePct > 0 && ratePct < 3);
    addOrRemove(heating, ratePct <= -2 && vol > 10000);
  };

  const startPolling = () => {
    // 1.5초마다 REST로 갱신 (WS가 막힌 환경용)
    const markets = CODES.join(",");
    const tick = async () => {
      try {
        const rows = await getTickers(CODES);
        rows?.forEach(classify);
        flush("🟡 Upbit REST polling");
      } catch (e) {
        flush("⚠️ Upbit REST polling 오류");
        console.warn("[polling] error:", e);
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    stopPolling = () => clearInterval(id);
  };

  // 우선 WS 시도 → 안 되면 폴링으로 전환
  try {
    stopWS = startUpbitRealtime((evt) => {
      if (evt.type === "status") {
        flush(`🔌 ${evt.text}`);
        // evt.text에 'closed'가 포함되면 폴링 시작(중복 시작 방지)
        if (/closed/i.test(evt.text)) {
          if (!stopPolling) startPolling();
        }
        return;
      }
      if (evt.type === "tick") {
        classify(evt.data);
        flush("✅ Upbit WS connected");
      }
    }, { codes: CODES, reconnect: true });
  } catch (e) {
    console.warn("[realtime_detector] WS 불가 → polling 전환:", e);
    startPolling();
  }

  // 정리 함수 반환
  return () => {
    try { stopWS?.(); } catch {}
    try { stopPolling?.(); } catch {}
  };
}
