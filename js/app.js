async function scanCoins() {
  // 1) 전체 마켓 로드
  const markets = await loadMarkets();
  const krw = markets.filter(m => m.market.startsWith("KRW-"));

  // 2) 100개씩 청크로 끊어서 티커 요청
  const tickers = [];
  for (let i = 0; i < krw.length; i += 100) {
    const chunk = krw.slice(i, i + 100);
    const codes = chunk.map(m => m.market).join(",");
    const rows = await getJSON(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.upbit.com/v1/ticker?markets=${codes}`)}`);
    tickers.push(...rows);
    await new Promise(r => setTimeout(r, 180)); // 레이트 제한 보호
  }

  // 3) 분류
  const hot  = tickers.filter(x => x.signed_change_rate >= 0.05)
                      .sort((a,b)=>b.signed_change_rate - a.signed_change_rate).slice(0,10);
  const warm = tickers.filter(x => x.signed_change_rate >= 0.02 && x.signed_change_rate < 0.05)
                      .sort((a,b)=>b.signed_change_rate - a.signed_change_rate).slice(0,10);
  const heat = tickers.filter(x => x.signed_change_rate <= -0.02)
                      .sort((a,b)=>a.signed_change_rate - b.signed_change_rate).slice(0,10);

  // 4) 렌더
  renderList("hot-list",  hot,  markets);
  renderList("warm-list", warm, markets);
  renderList("heat-list", heat, markets);
}
