import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const resp = await fetch("https://api.upbit.com/v1/ticker/all");
    const data = await resp.json();

    const tickers = data.filter((d) => d.market?.startsWith("KRW-"));
    const rows = tickers.slice(0, 20).map((t) => ({
      symbol: t.market,
      nameKr: t.korean_name || t.market,
      now: t.trade_price,
      targets: { long: { B1: t.trade_price * 0.98, TP1: t.trade_price * 1.02 } },
      warmState: t.signed_change_rate > 0.05 ? "예열" : "-",
    }));

    const spikes = {
      up: tickers
        .filter((t) => t.signed_change_rate > 0.1)
        .slice(0, 5)
        .map((t) => ({ symbol: t.market, change: (t.signed_change_rate * 100).toFixed(2) })),
      down: tickers
        .filter((t) => t.signed_change_rate < -0.1)
        .slice(0, 5)
        .map((t) => ({ symbol: t.market, change: (t.signed_change_rate * 100).toFixed(2) })),
    };

    res.status(200).json({ ok: true, tickers, rows, spikes });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message });
  }
}
