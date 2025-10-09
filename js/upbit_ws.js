// /js/upbit_ws.js
// 업비트 실시간(WebSocket) 시세 스트리밍
// - 기존 기능 유지: startUpbitRealtime(onTick)
// - 추가 기능: onTicker(여러 군데에서 동시에 구독), setCodes(마켓 변경), 안전한 재연결, 중복연결 방지

// 기본 구독 마켓 (원하면 나중에 setCodes([...])로 바꿔도 됨)
const CODES = ["KRW-BTC"];

// 내부 상태
let ws = null;
let backoff = 1000; // 재연결 백오프 (1s→2s→4s… 최대 10s)
const MAX_BACKOFF = 10000;
let lastOnTick = null; // startUpbitRealtime에 전달된 콜백 저장
const _listeners = []; // onTicker()로 등록되는 리스너들

// ----- 유틸 (브로드캐스트) -----
function _emitTick(t) {
  for (const fn of _listeners) {
    try { fn(t); } catch {}
  }
}

// 외부에서 여러 군데에서 동시에 실시간 틱을 구독할 수 있게 함
export function onTicker(fn) {
  if (typeof fn === "function") _listeners.push(fn);
}

// 구독 마켓 변경 (다음 연결부터 반영)
// 즉시 반영이 필요하면 forceReconnect=true로 호출
export function setCodes(arr = [], forceReconnect = false) {
  if (Array.isArray(arr) && arr.length) {
    CODES.length = 0;
    CODES.push(...arr);
    if (forceReconnect) {
      safeClose();
      connect(lastOnTick);
    }
  }
}

// 중복 연결 방지용 안전 종료
function safeClose() {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  } catch {}
  ws = null;
}

// 실제 연결
function connect(onTick) {
  lastOnTick = typeof onTick === "function" ? onTick : null;

  // 이미 열려 있으면 재사용 (중복 연결 방지)
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket("wss://api.upbit.com/websocket/v1");
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    // 연결 성공 → 백오프 초기화
    backoff = 1000;

    // 구독 메시지 전송
    const msg = [
      { ticket: "satoshi-wallet" },
      { type: "ticker", codes: CODES } // isOnlyRealtime 생략해도 실시간 틱 옴
    ];
    try { ws.send(JSON.stringify(msg)); } catch {}
    console.log("✅ Upbit WS connected:", CODES.join(", "));
  };

  ws.onmessage = (ev) => {
    try {
      // 업비트는 바이너리(JSON)로 주니까 디코드 필요
      const text = new TextDecoder().decode(ev.data);
      const d = JSON.parse(text);

      const price = d.trade_price ?? d.tp;
      if (price && d.code) {
        const tick = {
          code: d.code,
          price,
          ts: d.trade_timestamp || Date.now(),
          vol: d.trade_volume ?? null,                 // 체결량
          accVol24h: d.acc_trade_volume_24h ?? null,  // 24h 누적 거래량
          chgRate: (d.signed_change_rate ?? 0) * 100  // % (업비트는 소수 → 퍼센트 변환)
        };

        // 기존 콜백 유지
        if (lastOnTick) {
          try { lastOnTick(tick); } catch {}
        }
        // 멀티 리스너 브로드캐스트(새 기능)
        _emitTick(tick);
      }
    } catch (e) {
      // 파싱 실패 등은 무시하고 계속
    }
  };

  ws.onerror = () => {
    try { ws.close(); } catch {}
  };

  ws.onclose = () => {
    console.warn("⚠️ Upbit WS closed → reconnecting…");
    const wait = backoff;
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
    setTimeout(() => connect(lastOnTick), wait);
  };
}

// 외부에서 한번만 불러도 동작하도록 유지 (기존 API)
export function startUpbitRealtime(updateFn) {
  connect(updateFn);
}

// 선택: 외부에서 강제로 끊고 싶을 때 사용할 수 있게 공개
export function stopUpbitRealtime() {
  safeClose();
}
