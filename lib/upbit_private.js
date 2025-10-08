// /lib/upbit_private.js
// 업비트 Open API (IP 화이트리스트/키 기반) + 고성능 공개 API 헬퍼
// - 공개 엔드포인트: 인증 없이도 사용 가능 (keep-alive + 타임아웃 적용)
// - 개인(API 키) 엔드포인트: JWT 서명 생성해 Authorization 헤더 부착
// - 이 모듈로 교체하면 속도/안정성↑, 429↓

// ---- 설정 ----
const BASE = "https://api.upbit.com/v1";
const TIMEOUT_MS = 3500;

// Node fetch 타임아웃 래퍼
async function withTimeout(p, ms = TIMEOUT_MS) {
  let t; const killer = new Promise((_, rej) => t = setTimeout(() => rej(new Error("timeout")), ms));
  try { return await Promise.race([p, killer]); }
  finally { clearTimeout(t); }
}

// 간단한 쿼리스트링 빌더 (key 순서 고정)
function toQuery(params = {}) {
  const keys = Object.keys(params).sort();
  return keys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
}

// === 공개(무인증) 호출: 속도개선(keep-alive)은 플랫폼에 따라 자동 적용됨 ===
export async function publicJson(path, params = {}) {
  const qs = toQuery(params);
  const url = qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
  const res = await withTimeout(fetch(url, { headers: { accept: "application/json" } }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// === 개인(서명) 호출: 읽기 전용도 가능 ===
// Upbit는 HS256 JWT + query_hash(SHA512) 사용
import crypto from "crypto";

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function hmacSHA256(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}
function sha512Hex(str) {
  return crypto.createHash("sha512").update(str).digest("hex");
}

function makeJWT({ accessKey, secretKey, params }) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    access_key: accessKey,
    nonce: crypto.randomUUID(),
  };

  const qs = toQuery(params);
  if (qs) {
    payload.query_hash = sha512Hex(qs);
    payload.query_hash_alg = "SHA512";
  }

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = base64url(hmacSHA256(`${headerB64}.${payloadB64}`, secretKey));
  return `${headerB64}.${payloadB64}.${signature}`;
}

function getKeys() {
  const access = process.env.UPBIT_ACCESS_KEY;
  const secret = process.env.UPBIT_SECRET_KEY;
  if (!access || !secret) throw new Error("UPBIT_ACCESS_KEY / UPBIT_SECRET_KEY가 설정되지 않았습니다.");
  return { access, secret };
}

export async function privateJson(path, params = {}) {
  const { access, secret } = getKeys();
  const token = makeJWT({ accessKey: access, secretKey: secret, params });
  const qs = toQuery(params);
  const url = qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
  const res = await withTimeout(fetch(url, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- 편의 함수 (지금 프로젝트에서 바로 쓸 수 있는 형태) ----

// 1) KRW 마켓 전체 (한글명 포함)
export async function marketsKRW() {
  const list = await publicJson("/market/all", { isDetails: true });
  return list
    .filter(m => m.market?.startsWith("KRW-"))
    .map(m => ({ market: m.market, korean_name: m.korean_name, english_name: m.english_name }));
}

// 2) 빠른 티커 (여러 마켓 동시)
export async function getTickerFast(markets) {
  if (!markets || !markets.length) return {};
  const qs = encodeURIComponent(markets.join(","));
  const arr = await publicJson("/ticker", { markets: qs }); // 공개 API도 충분히 빠름
  const map = {}; for (const t of arr) map[t.market] = t;
  return map;
}

// 3) 1분봉 캔들
export async function getCandles1mFast(market, count = 60) {
  const rows = await publicJson("/candles/minutes/1", { market, count });
  return rows.slice().reverse().map(r => ({
    time: new Date(r.timestamp).getTime(),
    open: Number(r.opening_price),
    high: Number(r.high_price),
    low: Number(r.low_price),
    close: Number(r.trade_price),
    volume: Number(r.candle_acc_trade_volume),
  }));
}

// 4) (예시) 개인 엔드포인트 사용 — 잔고 조회 등
// export async function getBalances() {
//   // 개인 API는 반드시 키/화이트리스트 필요
//   return privateJson("/accounts");
// }
