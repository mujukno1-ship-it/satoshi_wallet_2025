// /js/upbit_ws.js — 업비트 실시간 시세 WebSocket
const CODES = ["KRW-BTC"]; // 예시: 원하면 ["KRW-BTC", "KRW-ETH", "KRW-SOL"] 추가 가능
let ws, delay = 1000;
const MAX_DELAY = 10000;

function connect(onTick) {
  ws = new WebSocket("wss://api.upbit.com/websocket/v1");
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    delay = 1000;
    const msg = [
      { ticket: "satoshi-wallet" },
      { type: "ticker", codes: CODES }
    ];
    ws.send(JSON.stringify(msg));
    console.log("✅ 업비트 WebSocket 연결됨");
  };

  ws.onmessage = (e) => {
    const text = new TextDecoder().decode(e.data);
    const data = JSON.parse(text);
    const price = data.trade_price ?? data.tp;
    if (price && data.code) onTick({ code: data.code, price, ts: data.trade_timestamp || Date.now() });
  };

  ws.onerror = () => { try { ws.close(); } catch {} };
  ws.onclose = () => {
    console.warn("⚠️ 연결 끊김 → 재연결 시도 중...");
    setTimeout(() => connect(onTick), delay);
    delay = Math.min(delay * 2, MAX_DELAY);
  };
}

export function startUpbitRealtime(updateFn) {
  connect(updateFn);
}
