// ===== 유틸 =====
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const toKRW = (n) => new Intl.NumberFormat("ko-KR").format(n);

// CORS 우회용 프록시(무료): 업비트 REST 사용
async function getJSON(url, tries = 3){
  let err;
  for(let i=0;i<tries;i++){
    try{
      const r = await fetch(url, { cache:"no-store" });
      if(!r.ok) throw new Error("HTTP "+r.status);
      return await r.json();
    }catch(e){
      err = e; await delay(500 * (i+1));
    }
  }
  throw err;
}

const A = "https://api.allorigins.win/raw?url="; // 프록시 베이스
const UPBIT = "https://api.upbit.com";

// ===== 데이터 로더 =====
async function loadMarkets(){
  const url = `${A}${encodeURIComponent(`${UPBIT}/v1/market/all?isDetails=false`)}`;
  const res = await getJSON(url);
  return res.filter(m => m.market.startsWith("KRW-"));
}

async function loadTicker(market){
  const url = `${A}${encodeURIComponent(`${UPBIT}/v1/ticker?markets=${market}`)}`;
  const res = await getJSON(url);
  return Array.isArray(res) ? res[0] : res;
}

// ===== 검색 전용 =====
let marketsCache = null;
let pollTimer = null;

document.addEventListener("DOMContentLoaded", async ()=>{
  marketsCache = await loadMarkets();

  document.getElementById("search-btn").addEventListener("click", onSearch);
  document.getElementById("search-input").addEventListener("keydown", (e)=>{
    if(e.key === "Enter") onSearch();
  });
});

async function onSearch(){
  const q = document.getElementById("search-input").value.trim();
  if(!q) return;

  const hit = findMarket(q);
  if(!hit){
    renderEmpty("검색 결과 없음");
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    return;
  }

  // 즉시 1회 + 1.5초 폴링
  await renderRow(hit);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(()=>renderRow(hit), 1500);
}

function findMarket(q){
  const s = q.toLowerCase().replace(/\s/g,"");
  return marketsCache.find(m =>
    m.market.toLowerCase() === s ||
    (m.korean_name||"").replace(/\s/g,"").includes(s) ||
    (m.english_name||"").toLowerCase().includes(s)
  ) || marketsCache.find(m => m.market.toLowerCase().endsWith(s));
}

async function renderRow(hit){
  try{
    const tk = await loadTicker(hit.market);
    const rate = tk?.signed_change_rate ?? 0;
    const price = toKRW(tk.trade_price || 0);

    const status =
      rate >= 0.05 ? "급등" :
      rate >= 0.02 ? "예열" :
      rate <= -0.02 ? "가열" : "중립";

    const risk = rate >= 0.05 ? "3" : rate >= 0.02 ? "2" : "1";
    const decision =
      rate >= 0.05 ? "익절 구간" :
      rate >= 0.02 ? "관망" :
      rate <= -0.02 ? "저점 대기" : "보통";

    const row = `
      <tr>
        <td>${hit.korean_name} (${hit.market})</td>
        <td class="price ${tk.change==='RISE'?'up':(tk.change==='FALL'?'down':'')}">${price}</td>
        <td>${(rate*100).toFixed(2)}%</td>
        <td>${status}</td>
        <td>${risk}</td>
        <td>${decision}</td>
      </tr>`;
    document.getElementById("result-body").innerHTML = row;
  }catch(e){
    // 실패 시 메시지 유지
    renderEmpty("데이터 불러오기 실패… 재시도 중");
  }
}

function renderEmpty(msg){
  document.getElementById("result-body").innerHTML =
    `<tr><td colspan="6" class="empty">${msg}</td></tr>`;
}
