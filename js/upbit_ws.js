// 업비트 WebSocket: KRW-BTC 실시간 가격만 연결(지표용 베이스)
// 필요 심볼은 app.js에서 동적으로 재구독 가능하게 export 함수 제공

let ws = null;
let subscribed = new Set();
const listeners = new Set();

export function onTicker(cb){ listeners.add(cb); return ()=>listeners.delete(cb); }

export function connectWS() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;

  ws = new WebSocket("wss://api.upbit.com/websocket/v1");
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    setWSBadge(true);
    // 기본: BTC
    if (subscribed.size === 0) subscribed.add("KRW-BTC");
    sendSubscribe();
  };

  ws.onclose = () => {
    setWSBadge(false);
    // 자동 재연결
    setTimeout(connectWS, 1500);
  };

  ws.onerror = () => {
    setWSBadge(false);
  };

  ws.onmessage = async (e) => {
    try{
      // 업비트는 바이너리(JSON 문자열)로 옴 → 텍스트 변환
      let txt = "";
      if (e.data instanceof ArrayBuffer){
        txt = new TextDecoder("utf-8").decode(e.data);
      } else if (e.data.text) {
        txt = await e.data.text();
      } else {
        txt = String(e.data);
      }
      const data = JSON.parse(txt);
      if (data.type === "ticker") {
        listeners.forEach(fn => fn(data));
      }
    }catch(err){
      console.warn("WS parse error:", err);
    }
  };
}

export function subscribe(markets){
  markets.forEach(m => subscribed.add(m));
  sendSubscribe();
}

function sendSubscribe(){
  if (!ws || ws.readyState !== 1) return;
  const codes = Array.from(subscribed);
  const msg = [
    { ticket: "satoshi-wallet" },
    { type: "ticker", codes }
  ];
  ws.send(JSON.stringify(msg));
}

function setWSBadge(on){
  const el = document.getElementById("ws-status");
  if (!el) return;
  if (on){
    el.classList.remove("off"); el.classList.add("on");
    el.textContent = "Upbit WS connected";
  } else {
    el.classList.remove("on"); el.classList.add("off");
    el.textContent = "Upbit WS disconnected";
  }
}
