// /js/upbit_ws.js — 업비트 실시간 WebSocket 시세 스트리밍
const CODES = ["KRW-BTC"]; // 필요시 ["KRW-ETH","KRW-SOL"] 추가 가능
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
    console.log("✅ 업비트 실시간 연결됨");
  };

  ws.onmessage = (e) => {
    const text = new TextDecoder().decode(e.data);
    const d = JSON.parse(text);
    const price = d.trade_price ?? d.tp;
    if (price && d.code) onTick({ code: d.code, price });
  };

  ws.onerror = () => { try { ws.close(); } catch {} };
  ws.onclose = () => {
    console.warn("⚠️ 연결 끊김 → 재연결 중...");
    setTimeout(() => connect(onTick), delay);
    delay = Math.min(delay * 2, MAX_DELAY);
  };
}

export function startUpbitRealtime(updateFn) { connect(updateFn); }
