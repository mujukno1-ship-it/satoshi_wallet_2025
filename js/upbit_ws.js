// /js/upbit_ws.js — 업비트 실시간 틱 수신 (자동 재연결)
const CODES = ["KRW-BTC"]; // 필요시 "KRW-ETH","KRW-SOL" 등 추가
let ws, backoff = 1000;
const MAX_BACKOFF = 10000;

function connect(onTick) {
  ws = new WebSocket("wss://api.upbit.com/websocket/v1");
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    backoff = 1000;
    const req = [
      { ticket: "satoshi-wallet" },
      { type: "ticker", codes: CODES } // isOnlyRealtime 옵션은 생략해도 실시간 옴
    ];
    ws.send(JSON.stringify(req));
    console.log("✅ Upbit WS connected");
  };

  ws.onmessage = (e) => {
    const text = new TextDecoder().decode(e.data);
    const d = JSON.parse(text);
    const price = d.trade_price ?? d.tp;
    if (d.code && price) onTick({ code: d.code, price, ts: d.trade_timestamp || Date.now() });
  };

  ws.onerror = () => { try { ws.close(); } catch {} };
  ws.onclose = () => {
    console.warn("⚠️ WS closed → reconnecting…");
    setTimeout(() => connect(onTick), backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  };
}

export function startUpbitRealtime(update) { connect(update); }
export function setCodes(arr) { if (Array.isArray(arr) && arr.length) { CODES.length = 0; CODES.push(...arr); } }

