// ✅ Upbit API 호출 (CORS 프록시 없음 → JSONP 안쓰고 직접)
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("API 오류");
  return r.json();
}

// ✅ 숫자 -> 원화 포맷
const toKRW = n => new Intl.NumberFormat("ko-KR").format(n);

// ✅ 시세 불러오기
async function loadMarkets() {
  const res = await getJSON("https://api.allorigins.win/raw?url=https://api.upbit.com/v1/market/all?isDetails=false");
  return res.filter(m => m.market.startsWith("KRW-"));
}

// ✅ 단일 코인 현재가
async function loadTicker(market) {
  const res = await getJSON(`https://api.allorigins.win/raw?url=https://api.upbit.com/v1/ticker?markets=${market}`);
  return res[0];
}

// ✅ 급등 / 예열 / 가열 리스트
async function scanCoins() {
  const markets = await loadMarkets();
  const krwMarkets = markets.slice(0, 100); // 일부만 테스트
  const codes = krwMarkets.map(m => m.market).join(",");
  const tickers = await getJSON(`https://api.allorigins.win/raw?url=https://api.upbit.com/v1/ticker?markets=${codes}`);

  const hot = tickers.filter(x => x.signed_change_rate >= 0.05);
  const warm = tickers.filter(x => x.signed_change_rate >= 0.02 && x.signed_change_rate < 0.05);
  const heat = tickers.filter(x => x.signed_change_rate <= -0.02);

  renderList("hot-list", hot, markets);
  renderList("warm-list", warm, markets);
  renderList("heat-list", heat, markets);
}

function renderList(id, arr, all) {
  const ul = document.getElementById(id);
  ul.innerHTML = "";
  arr.forEach(x => {
    const item = all.find(m => m.market === x.market);
    const name = item?.korean_name || x.market;
    const rate = (x.signed_change_rate * 100).toFixed(2);
    const li = document.createElement("li");
    li.textContent = `${name} (${x.market}) · ${toKRW(x.trade_price)}원 · ${rate}%`;
    ul.appendChild(li);
  });
  if (arr.length === 0) ul.innerHTML = "<li>없음</li>";
}

// ✅ 검색 기능
async function searchCoin() {
  const input = document.getElementById("search-input").value.trim();
  if (!input) return;

  const markets = await loadMarkets();
  const hit = markets.find(m =>
    m.market.toLowerCase() === input.toLowerCase() ||
    m.korean_name.includes(input) ||
    m.english_name?.toLowerCase().includes(input.toLowerCase())
  );

  if (!hit) {
    document.getElementById("result-body").innerHTML = "<tr><td colspan='6' class='empty'>검색 결과 없음</td></tr>";
    return;
  }

  const data = await loadTicker(hit.market);
  const rate = (data.signed_change_rate * 100).toFixed(2);
  const price = toKRW(data.trade_price);
  const status = rate >= 5 ? "급등" : rate >= 2 ? "예열" : rate <= -2 ? "가열" : "중립";
  const risk = rate >= 5 ? "3" : rate >= 2 ? "2" : "1";
  const decision = rate >= 5 ? "익절 구간" : rate >= 2 ? "관망" : rate <= -2 ? "저점 대기" : "보통";

  document.getElementById("result-body").innerHTML = `
    <tr>
      <td>${hit.korean_name} (${hit.market})</td>
      <td>${price}</td>
      <td>${rate}%</td>
      <td>${status}</td>
      <td>${risk}</td>
      <td>${decision}</td>
    </tr>`;
}

// ✅ 초기 구동
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search-btn").addEventListener("click", searchCoin);
  scanCoins();
  setInterval(scanCoins, 30000); // 30초마다 갱신
});
