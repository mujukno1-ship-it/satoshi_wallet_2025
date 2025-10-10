// js/targets-engine.js
// ✅ 엔진: 설정을 읽어 타점(매수/매도/손절) 가격 배열을 생성

import { TARGETS_CONFIG } from "./targets-config.js";

// 호가 유틸은 app.js에 이미 있음. 없으면 아래 세 개를 그대로 복사해도 됨.
export function getTickKRW(p){
  if (p >= 2000000) return 1000;
  if (p >= 1000000) return 500;
  if (p >= 500000)  return 100;
  if (p >= 100000)  return 50;
  if (p >= 10000)   return 10;
  if (p >= 1000)    return 5;
  if (p >= 100)     return 1;
  if (p >= 10)      return 0.1;
  if (p >= 1)       return 0.01;
  if (p >= 0.1)     return 0.001;
  if (p >= 0.01)    return 0.0001;
  if (p >= 0.001)   return 0.00001;
  return 0.000001;
}
export function roundToTick(price, mode="nearest"){
  const t = getTickKRW(Math.abs(price));
  const q = price / t;
  let n = Math.round(q);
  if (mode === "down") n = Math.floor(q);
  if (mode === "up")   n = Math.ceil(q);
  const v = n * t;
  const dec = (t.toString().split(".")[1] || "").length;
  return Number(v.toFixed(dec));
}
export function formatKRW(p){
  const t = getTickKRW(Math.abs(p));
  const dec = (t.toString().split(".")[1] || "").length;
  return Number(p).toFixed(dec);
}

// ===== 엔진 로직 =====
const pctVal = (p, k) => p * (1 + k);
const ladder = (base, steps) => steps.map(k => base * (1 + k));

function pickConfig(ctx){
  // 시간대 우선
  for (const o of (TARGETS_CONFIG.timeOverrides || [])){
    try{ if (o.when?.(ctx)) return { ...TARGETS_CONFIG.default, ...o }; }catch{}
  }
  // 코인별 → 기본
  const coin = TARGETS_CONFIG[ctx.market];
  return coin ? { ...TARGETS_CONFIG.default, ...coin } : TARGETS_CONFIG.default;
}

function applyShape(price, shape, mode){
  if (!shape || shape.type==="none") return [];
  if (shape.type==="single"){
    return [ roundToTick(pctVal(price, shape.k), mode) ];
  }
  if (shape.type==="ladder"){
    const steps = (shape.steps || []).slice(0, TARGETS_CONFIG.default.maxLevels);
    return ladder(price, steps).map(v => roundToTick(v, mode));
  }
  if (shape.type==="custom" && typeof shape.fn === "function"){
    const arr = [].concat(shape.fn(price) || []);
    return arr.map(v => roundToTick(v, mode));
  }
  return [];
}

export function computeTargets(ctx){
  const cfg = pickConfig(ctx);

  for (const f of (cfg.filters || [])){
    try{ if (!f(ctx)) return { buy:[], take:[], stop:[], lane:"filtered" }; }catch{}
  }
  const lane = (cfg.lanes || []).find(l => { try{ return l.when?.(ctx); }catch{ return false; } });
  const active = lane || { buy:{type:"none"}, take:{type:"none"}, stop:{type:"none"}, name:"default" };

  const buy  = applyShape(ctx.price, active.buy,  "down"); // 매수/손절: 내림
  const take = applyShape(ctx.price, active.take, "up");   // 매도: 올림
  const stop = applyShape(ctx.price, active.stop, "down");

  return { buy, take, stop, lane: active.name || "default" };
}
