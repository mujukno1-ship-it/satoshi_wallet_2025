// /js/upbit_ws.js — 업비트 WebSocket 최소 안정 버전
// 참고: Upbit는 WS payload를 JSON 텍스트로 내려준다(브라우저에서는 ArrayBuffer → TextDecoder)

const WS_URL = "wss://api.upbit.com/websocket/v1";

// codes 예: ["KRW-BTC","KRW-ETH", ...]
export function startUpbitRealtime(onTick, { codes = ["KRW-BTC"], reconnect = true } = {}) {
  let ws;
  let stopped = false;
  let delay = 1000;

  const open = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        delay = 1000;
        const msg = [
          { ticket: "satoshi-wallet" },
          { type: "ticker", codes }
        ];
        ws.send(JSON.stringify(msg));
        onTick?.({ type: "status", text: "✅ Upbit WS connected" });
      };

      ws.onmessage = (e) => {
        try {
          const text = new TextDecoder().decode(e.data);
          const d = JSON.parse(text);
          // d.code: "KRW-BTC", d.trade_price, d.signed_change_rate 등
          onTick?.({ type: "tick", data: d });
        } catch (err) {
          console.warn("[upbit_ws] parse 실패:", err);
        }
      };

      ws.onclose = () => {
        onTick?.({ type: "status", text: "⚠️ Upbit WS closed → reconnecting…" });
        if (reconnect && !stopped) {
          setTimeout(open, delay);
          delay = Math.min(delay * 2, 15000);
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch (e) {
      console.error("[upbit_ws] open 실패:", e);
      if (reconnect && !stopped) setTimeout(open, delay);
    }
  };

  open();

  return () => {
    stopped = true;
    try { ws?.close(); } catch {}
  };
}
