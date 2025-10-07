import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

app.use(express.static(path.join(__dirname, "public")));
app.use((_, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });

// 업비트 프록시 (markets / top / candles)
app.get("/api/upbit", async (req, res) => {
  try {
    const { fn } = req.query;
    let url = null;

    if (fn === "markets") {
      url = "https://api.upbit.com/v1/market/all?isDetails=false";
    } else if (fn === "top") {
      // KRW- 전종목 현재가/변화율 묶어서 반환
      const mk = await fetch("https://api.upbit.com/v1/market/all?isDetails=true").then(r => r.json());
      const krw = mk.filter(x => (x.market || "").startsWith("KRW-")).map(x => x.market).join(",");
      url = "https://api.upbit.com/v1/ticker?markets=" + encodeURIComponent(krw);
    } else if (fn === "candles") {
      const minutes = Number(req.query.minutes || 1);
      const market = req.query.market || "KRW-BTC";
      const count  = Number(req.query.count  || 200);
      url = `https://api.upbit.com/v1/candles/minutes/${minutes}?market=${encodeURIComponent(market)}&count=${count}`;
    } else {
      return res.status(400).json({ ok:false, error:"unknown fn" });
    }

    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    const j = await r.json();
    res.json({ ok:true, data:j, markets:j.markets });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
