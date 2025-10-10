// 간단 스캐너: 20초마다 KRW-마켓 전체 24h 변동률 기반으로 분류
// 급등: 변화율 >= +5%
// 예열: +2% ~ +5%
// 가열: -2% 이하 하락 중 (주의)

const UPBIT_API = "https://api.upbit.com";

export async function runScannerLoop(){
  await scanOnce();                // 최초 1회
  setInterval(scanOnce, 20000);    // 20초 주기
}

async function scanOnce(){
  try{
    const markets = await fetchJSON(`${UPBIT_API}/v1/market/all?isDetails=false`);
    const krw = markets.filter(m => m.market.startsWith("KRW-"));

    // 100개씩 끊어서 호출
    const chunks = [];
    for (let i=0;i<krw.length;i+=100) chunks.push(krw.slice(i,i+100));

    const tickers = [];
    for (const ch of chunks){
      const qs = ch.map(m=>m.market).join(",");
      const rows = await fetchJSON(`${UPBIT_API}/v1/ticker?markets=${qs}`);
      tickers.push(...rows);
      // API rate 보호
      await delay(200);
    }

    const withName = tickers.map(t => {
      const item = markets.find(m => m.market === t.market);
      return {
        market: t.market, korean_name: item?.korean_name || t.market,
        trade_price: t.trade_price,
        signed_change_rate: t.signed_change_rate, // -0.0123 → -1.23%
        acc_trade_price_24h: t.acc_trade_price_24h
      };
    });

    // 분류
    const hot = withName
      .filter(x => x.signed_change_rate >= 0.05)
      .sort((a,b)=>b.signed_change_rate - a.signed_change_rate)
      .slice(0,10);

    const warm = withName
      .filter(x => x.signed_change_rate >= 0.02 && x.signed_change_rate < 0.05)
      .sort((a,b)=>b.signed_change_rate - a.signed_change_rate)
      .slice(0,10);

    const heat = withName
      .filter(x => x.signed_change_rate <= -0.02)
      .sort((a,b)=>a.signed_change_rate - b.signed_change_rate)
      .slice(0,10);

    renderList("hot-list", hot);
    renderList("warm-list", warm);
    renderList("heat-list", heat);

  }catch(e){
    console.warn("scan error:", e);
  }
}

function renderList(id, arr){
  const ul = document.getElementById(id);
  if (!ul) return;
  ul.innerHTML = "";
  if (arr.length === 0){ ul.innerHTML = "<li>없음</li>"; return; }
  arr.forEach(x=>{
    const li = document.createElement("li");
    const rate = (x.signed_change_rate*100).toFixed(2) + "%";
    li.textContent = `${x.korean_name} (${x.market}) · ${toKRW(x.trade_price)} · ${rate}`;
    ul.appendChild(li);
  });
}

function toKRW(n){ return new Intl.NumberFormat("ko-KR").format(n); }
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function fetchJSON(url){
  const r = await fetch(url); if(!r.ok) throw new Error(r.status+" "+url); return r.json();
}
