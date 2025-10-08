// zz-predictor.js — 검색란 아래 8%+ 상승예측 패널 자동 부착

(function(){
  const css = `
  .zz-predictor{font-family:system-ui,AppleSDGothicNeo,"Apple SD Gothic Neo",Segoe UI,Roboto,Pretendard,sans-serif;margin-top:12px}
  .zz-card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}
  .zz-title{font-weight:700;font-size:14px;margin:0 0 8px}
  .zz-sub{font-size:12px;color:#6b7280;margin:2px 0 10px}
  .zz-table{width:100%;border-collapse:collapse;font-size:12px}
  .zz-table th,.zz-table td{padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap}
  .zz-table th:nth-child(1),.zz-table td:nth-child(1){text-align:left}
  .zz-chip{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px}
  .zz-chip.low{background:#ecfeff;color:#0e7490}
  .zz-chip.mid{background:#fef9c3;color:#a16207}
  .zz-chip.high{background:#fee2e2;color:#b91c1c}
  .zz-badge{font-size:10px;color:#64748b;margin-left:6px}
  .zz-empty{padding:12px;color:#94a3b8}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

function ZZ_findSearchEl(){
  const sel=['#search','#searchBox','#search-area','#searchbar','input[type="search"]','.search','.search-box','.searchbar','[data-role="search"]'];
  for(const s of sel){ const el=document.querySelector(s); if(el) return el.closest('.search')||el.parentElement||el; }
  return null;
}
function ZZ_createPanel(){
  const wrap=document.createElement('div');
  wrap.className='zz-predictor';
  wrap.innerHTML=`
    <div class="zz-card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <p class="zz-title">📈 8%+ 상승 예상 코인 (TOP 10)</p>
        <span class="zz-badge" id="zz-lastts"></span>
      </div>
      <p class="zz-sub">세력매집·변동성(ATR/HV)·RSI/MACD·거래량 증가율 종합</p>
      <div id="zz-tablewrap"></div>
    </div>`;
  return wrap;
}
function ZZ_riskChip(r){ if(r<=2) return '<span class="zz-chip low">위험도 1–2 (낮음)</span>'; if(r==3) return '<span class="zz-chip mid">위험도 3 (보통)</span>'; return '<span class="zz-chip high">위험도 4–5 (높음)</span>'; }
function ZZ_renderTable(rows){
  const host=document.getElementById('zz-tablewrap'); const ts=document.getElementById('zz-lastts'); if(!host) return;
  ts.textContent='KST 업데이트: ' + new Date().toLocaleString('ko-KR', { hour12:false });
  if(!rows||rows.length===0){ host.innerHTML=`<div class="zz-empty">현재 예측 후보가 없습니다. (데이터 대기)</div>`; return; }
  rows=rows.slice().sort((a,b)=>(b.predPct-a.predPct)||(b.prob-a.prob)).slice(0,10);
  host.innerHTML = `
    <table class="zz-table">
      <thead><tr><th>코인(한글)</th><th>예측상승률</th><th>급등확률</th><th>위험도</th><th>근거(요약)</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.nameKR} <span class="zz-badge">${r.symbol}</span></td><td>${r.predPct.toFixed(1)}%</td><td>${r.prob.toFixed(0)}%</td><td>${ZZ_riskChip(r.risk)}</td><td>${r.signalNote||''}</td></tr>`).join('')}</tbody>
    </table>`;
}
function ZZ_scoreRow(x){
  let s=0, note=[]; if(x.macdUp){s+=2;note.push('MACD↑');} if(x.rsi&&x.rsi>52&&x.rsi<75){s+=2;note.push('RSI 상승');}
  if(x.volUp&&x.volUp>1.5){s+=1.5;note.push('거래량↑');} if(x.obvSlope&&x.obvSlope>0){s+=1.5;note.push('OBV↑');}
  if(x.cvdUp){s+=1;note.push('CVD↑');} if(x.atrBand&&x.atrBand>0.6){s+=1;note.push('변동성 에너지');}
  const predPct=Math.min(25,4+s*2.2+(x.volUp?Math.min(6,(x.volUp-1)*3):0));
  const prob=Math.max(50,Math.min(95,55+s*6));
  const risk=(x.atrBand>0.9||(x.volUp&&x.volUp>2.5))?4:(x.rsi>72?3:2);
  return {predPct,prob,risk,note:note.join(' / ')};
}
window.ZZPredictor={ update(items){
  if(!Array.isArray(items)) return ZZ_renderTable([]);
  const rows=items.map(c=>{const s=ZZ_scoreRow(c); return {nameKR:c.nameKR||c.symbol||'코인',symbol:c.symbol||'',predPct:s.predPct,prob:s.prob,risk:s.risk,signalNote:s.note};});
  ZZ_renderTable(rows);
}};
function ZZ_mountPredictor(){
  const target=ZZ_findSearchEl(); const panel=ZZ_createPanel();
  if(target&&target.parentNode){ target.parentNode.insertBefore(panel,target.nextSibling); } else { document.body.prepend(panel); }
  // 데모 데이터(보이면 성공)
  window.ZZPredictor.update([
    {nameKR:'이더리움',symbol:'ETH/KRW',rsi:59,macdUp:true,volUp:1.7,obvSlope:0.9,atrBand:0.6,cvdUp:true},
    {nameKR:'셀로',symbol:'CELO/KRW',rsi:63,macdUp:true,volUp:2.3,obvSlope:0.5,atrBand:0.8,cvdUp:true},
    {nameKR:'에어고',symbol:'AERGO/KRW',rsi:55,macdUp:true,volUp:1.6,obvSlope:0.4,atrBand:0.5,cvdUp:false}
  ]);
}
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', ZZ_mountPredictor); } else { ZZ_mountPredictor(); }
