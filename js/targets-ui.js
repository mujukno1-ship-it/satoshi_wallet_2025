// js/targets-ui.js
// ✅ 타점 배열을 표에 쓰기 좋은 문자열로 변환

import { formatKRW } from "./targets-engine.js";

export function primaryAndTooltip(arr){
  if (!arr || !arr.length) return { text:"", title:"" };
  const all = arr.map(formatKRW);
  return { text: all[0], title: all.join(", ") };
}
