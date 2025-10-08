// /js/upbit.js — 프론트에서 동일출처 프록시(/api/upbit) 호출

async function callApi(url, { retry = 2 } = {}) {
  for (let i = 0; i <= retry; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP_${r.status}`);
      return await r.json();
    } catch (err) {
      if (i === retry) throw err;
      await new Promise(res => setTimeout(res, 600 * (i + 1))); // 점진적 재시도
    }
  }
}

export async function getUpbitPrice(market = "KRW-BTC") {
  try {
    const j = await callApi(`/api/upbit?market=${encodeURIComponent(market)}`, { retry: 2 });
    return typeof j?.trade_price === "number" ? j.trade_price : null;
  } catch (e) {
    console.error("[getUpbitPrice] 실패:", e);
    return null;
  }
}
