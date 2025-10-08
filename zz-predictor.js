// zz-predictor.js — 기존 화면은 그대로 유지, 기능만 깔끔 추가
import { getUpbitPrice } from "/js/upbit.js";

/* ---------- 공통 포맷터 ---------- */
function fmtKRW(x, max = 4) {
  return (typeof x === "number" && isFinite(x))
    ? x.toLocaleString("ko-KR", { maximumFractionDigits: max }) + " 원"
    : "불러오기 실패";
}

/* ---------- 1) 업비트 실시간 시세 박스 (검색창 아래 자동 부착) ---------- */
(function mountUpbitBox(){
  const box = document.createElement("div");
  box.id = "upbit-price-box";
  box.style.cssText = "max-width:520px;margin:16px auto;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.05);font-family:system-ui,Pretendard,sans-serif;font-size:15px;line-height:1.8";
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <b>💰 업비트 실시간 시세</b><small id="zz-upbit-ts" style="color:#64748b">불러오는 중...</small>
    </div><div id="zz-upbit-lines" style="margin-top:8px">불러오는 중...</div>`;

  const candidates = ['#search','#searchBox','#search-area','#searchbar','input[type="search"]','.search','.search-box','.searchbar','[data-role="search"]'];
  let target = null; for (const s of candidates){ const el = document.querySelector(s); if(el){ target = el.closest('.search')||el.parentElement||el; break; } }
  if (target?.parentNode) target.parentNode.insertBefore(box, target.nextSibling);
  else document.body.prepend(box);
})();

/* ---------- 2) 8%+ 상승 예측 패널 (데모 + 실데이터 훅) ---------- */
(function mountPredictor(){
  const css = `.zz-predictor{font-family:system-ui,Pretendard,sans-serif;margin:12px auto;max-width:920px}
  .zz-card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}
  .zz-title{font-weight:700;font-size:14px;margin:0 0 8px}
  .zz-sub{font-size:12px;color:#6b7280;margin:2px 0 10px}
  .zz-table{width:100%;border-collapse:collapse;font-size:12px}
  .zz-table th,.zz-table td{padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap}
  .zz-table th:nth-child(1),.zz-table td:nth-child(1){text-align:left}
  .zz-chip{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px}
  .zz-chip.low{background:#ecfeff;color:#0e7490}.zz-chip.mid{background:#fef9c3;color:#a16207}.zz-chip.high{background:#fee2e2;color:#b91c1c}
  .zz-badge{font-size:10px;color:#64748b;margin-left:6px}.zz-empty{padding:12px;color:#94a3b8}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function card(){
    const w = document.createElement("div");
    w.className = "zz-predictor";
    w.innerHTML = `<div class="zz-card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <p class="zz-title">📈 8%+ 상승 예상 코인 (TOP 10)</p><span class="zz-badge" id="zz-lastts"></span>
        </div><p class="zz-sub">변동성(ATR/HV)·RSI/MACD·거래량 증가율·OBV·CVD를 단순 점수화한 예측(데모)</p>
        <div id="zz-tablewrap"></div>
      </div>`;
    return w;
  }
  function riskChip(r){ if(r<=2) return '<span class="zz-chip low">위험도 1–2</span>'; if(r==3) return '<span class="zz-chip mid">위험도 3</span>'; return '<span class="zz-chip high">위험도 4–5</span>'; }
  function renderTable(rows){
    const host = document.getElementById("zz-tablewrap"), ts = document.getElementById("zz-lastts");
    if (!host) return;
    ts.textContent = "KST 업데이트: " + new Date().toLocaleString("ko-KR",{hour12:false});
    if (!rows || rows.length === 0){ host.innerHTML = '<div class="zz-empty">현재 예측 후보가 없습니다.</div>'; return; }
    rows = rows.slice().sort((a,b)=>(b.predPct-a.predPct)||(b.prob-a.prob)).slice(0,10);
    host.innerHTML = `<table class="zz-table"><thead><tr>
        <th>코인(한글)</th><th>예측상승률</th><th>급등확률</th><th>위험도</th><th>근거</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${r.nameKR} <span class="zz-badge">${r.symbol}</span></td>
        <td>${r.predPct.toFixed(1)}%</td>
        <td>${r.prob.toFixed(0)}%</td>
        <td>${riskChip(r.risk)}</td>
        <td>${r.signalNote||""}</td></tr>`).join("")}</tbody></table>`;
  }
  function score(x){ let s=0,n=[];
    if(x.macdUp){s+=2;n.push("MACD↑");}
    if(x.rsi && x.rsi>52 && x.rsi<75){s+=2;n.push("RSI 상승");}
    if(x.volUp && x.volUp>1.5){s+=1.5;n.push("거래량↑");}
    if(x.obvSlope && x.obvSlope>0){s+=1.5;n.push("OBV↑");}
    if(x.cvdUp){s+=1;n.push("CVD↑");}
    if(x.atrBand && x.atrBand>0.6){s+=1;n.push("변동성");}
    const predPct = Math.min(25, 4 + s*2.2 + (x.volUp?Math.min(6, (x.volUp-1)*3):0));
    const prob = Math.max(50, Math.min(95, 55 + s*6));
    const risk = (x.atrBand>0.9 || (x.volUp&&x.volUp>2.5)) ? 4 : (x.rsi>72?3:2);
    return {predPct, prob, risk, note:n.join(" / ")};
  }
  window.ZZPredictor = {
    update(items){
      if(!Array.isArray(items)) return renderTable([]);
      const rows = items.map(c => {
        const s = score(c);
        return { nameKR: c.nameKR||c.symbol||"코인", symbol:c.symbol||"", predPct:s.predPct, prob:s.prob, risk:s.risk, signalNote:s.note };
      });
      renderTable(rows);
    }
  };

  const sel = ['#search','#searchBox','#search-area','#searchbar','input[type="search"]','.search','.search-box','.searchbar','[data-role="search"]'];
  let t=null; for(const s of sel){const el=document.querySelector(s); if(el){t=el.closest('.search')||el.parentElement||el; break;}}
  const p = card(); if(t?.parentNode) t.parentNode.insertBefore(p, t.nextSibling); else document.body.appendChild(p);

  // 데모 데이터 (설치 확인용). 실데이터 연결 시 window.ZZPredictor.update(...)로 덮어쓰기.
  window.ZZPredictor.update([
    {nameKR:"이더리움",symbol:"ETH/KRW",rsi:59,macdUp:true,volUp:1.7,obvSlope:0.9,atrBand:0.6,cvdUp:true},
    {nameKR:"셀로",symbol:"CELO/KRW",rsi:63,macdUp:true,volUp:2.3,obvSlope:0.5,atrBand:0.8,cvdUp:true},
    {nameKR:"에어고",symbol:"AERGO/KRW",rsi:55,macdUp:true,volUp:1.6,obvSlope:0.4,atrBand:0.5,cvdUp:false}
  ]);
})();

/* ---------- 3) 시세 갱신 루프 (기존 유지 + 안정화) ---------- */
const COINS = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-DOGE"]; const COINS = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-DOGE", "KRW-SHIB", "KRW-AVAX"];
// 필요에 따라 이 배열만 수정
async function renderUpbitBox() {
  const wrap = document.getElementById("zz-upbit-lines");
  const ts = document.getElementById("zz-upbit-ts");
  if (!wrap) return;
  ts.textContent = "KST " + new Date().toLocaleString("ko-KR",{hour12:false});
  wrap.innerHTML = "";
  for (const mkt of COINS) {
    const px = await getUpbitPrice(mkt);
    const name = mkt.replace("KRW-","");
    wrap.innerHTML += `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding:4px 0">
      <span>💎 ${name}</span><b>${fmtKRW(px)}</b></div>`;
  }
}
renderUpbitBox();
setInterval(renderUpbitBox, 3000);
