// 급등/급락 탐지 (5틱 평균 대비 거래량·가격 변화)
export function detectSpike(ohlc) {
  if (!ohlc || ohlc.length < 6) return { state: "정상" };
  const last = ohlc.at(-1);
  const prev = ohlc.slice(-6, -1);

  const avgVol   = prev.reduce((a,b)=>a+b.volume,0)/prev.length || 1;
  const avgClose = prev.reduce((a,b)=>a+b.close,0)/prev.length || last.close;

  const volRatio  = last.volume / avgVol;                        // 배수
  const changePct = ((last.close - avgClose)/avgClose) * 100;    // %

  let state = "정상";
  if (volRatio > 5 && changePct > 5) state = "과열🔥";
  else if (volRatio > 3 && changePct > 3) state = "급등🚀";
  else if (volRatio > 2 && changePct > 1) state = "예열♨️";
  else if (volRatio > 3 && changePct < -3) state = "급락⚠️";

  return {
    state,
    volRatio: Number(volRatio.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
  };
}
