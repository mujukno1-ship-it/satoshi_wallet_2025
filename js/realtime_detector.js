// /js/realtime_detector.js — 실시간 분류(급등/예열/가열) 최소 구현
import { startUpbitRealtime } from "./upbit_ws.js";

// 필요한 심볼만 구독 (원한다면 더 추가)
const CODES = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-SOL"];

export function startRealtimeDetector(onUpdate) {
  let soaring = []; // 급등
  let warning = []; // 예열
  let heating = []; // 가열

  const up = startUpbitRealtime((evt) => {
    if (evt.type === "status") {
      onUpdate?.({ soaring, warning, heating, statusText: `🔌 ${evt.text}` });
      return;
    }
    if (evt.type !== "tick") return;

    const d = evt.data;             // { code, trade_price, signed_change_rate, acc_trade_volume_24h ...}
    const code = d?.code;
    if (!code) return;

    const ratePct = Math.round((d?.signed_change_rate ?? 0) * 100); // -100~+100
    // 간단한 분류 규칙 (임시)
    // +3% 이상 → 급등 / 0~+3% → 예열 / -2% 이내이고 거래량 큰 경우 → 가열 (취향대로)
    const vol = Number(d?.acc_trade_volume_24h ?? 0);

    const addIf = (arr, cond) => {
      const name = `${code} : ${Number(d?.trade_price ?? 0).toLocaleString()}원`;
      const i = arr.indexOf(name);
      if (cond) {
        if (i < 0) arr.unshift(name);
        if (arr.length > 20) arr.pop();
      } else {
        if (i >= 0) arr.splice(i, 1);
      }
    };

    addIf(soaring, ratePct >= 3);
    addIf(warning, ratePct > 0 && ratePct < 3);
    addIf(heating, ratePct <= -2 && vol > 10000);

    onUpdate?.({
      soaring, warning, heating,
      statusText: "✅ Upbit WS connected"
    });
  }, { codes: CODES });

  // 반환: 정리 함수
  return () => up?.();
}
