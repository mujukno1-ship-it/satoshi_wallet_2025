# main.py — Satoshi Wallet API (no-telegram)
import os, asyncio, time
from collections import deque
from typing import Dict, Deque, Tuple, List

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

MARKETS: List[str] = ["KRW-BTC", "KRW-ETH", "KRW-SHIB"]
FETCH_INTERVAL = 1.0
ALERT_WINDOW = 60.0
ALERT_PCT = 3.0

state: Dict[str, Dict[str, object]] = {m: {"price": None, "history": deque(maxlen=600)} for m in MARKETS}

# CORS: Vercel 주소만 허용(없으면 * 로)
ALLOW = os.getenv("CORS_ALLOW_ORIGINS", "https://satoshi-wallet-2025.vercel.app")
allow_origins = [o.strip() for o in ALLOW.split(",") if o.strip()]

try:
    import winsound
    def beep(): winsound.Beep(1200, 150)
except Exception:
    def beep(): pass

app = FastAPI(title="Satoshi Wallet API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"ok": True, "service": "Satoshi Wallet API", "markets": MARKETS}

@app.get("/health")
async def health():
    return {"ok": True}

@app.get("/ticker")
async def ticker():
    return {m: {"price": state[m]["price"]} for m in MARKETS}

@app.get("/stream")
async def stream():
    async def gen():
        while True:
            snapshot = {m: {"price": state[m]["price"]} for m in MARKETS}
            yield {"event": "tick", "data": str(snapshot)}
            await asyncio.sleep(1.0)
    return EventSourceResponse(gen())

@app.exception_handler(Exception)
async def default_ex_handler(_, exc: Exception):
    return JSONResponse(status_code=500, content={"ok": False, "error": str(exc)})

async def fetch_prices_loop():
    markets_param = ",".join(MARKETS)
    url = f"https://api.upbit.com/v1/ticker?markets={markets_param}"
    async with httpx.AsyncClient(timeout=4.0) as s:
        while True:
            try:
                r = await s.get(url)
                r.raise_for_status()
                data = r.json()
                now = time.time()
                for item in data:
                    m = item["market"]
                    price = float(item["trade_price"])
                    state[m]["price"] = price
                    hist: Deque[Tuple[float, float]] = state[m]["history"]
                    hist.append((now, price))
                    base = None
                    for ts, p in hist:
                        if now - ts >= ALERT_WINDOW:
                            base = p
                        else:
                            break
                    if base is None and hist:
                        base = hist[0][1]
                    if base and base > 0:
                        pct = (price - base) / base * 100
                        if abs(pct) >= ALERT_PCT:
                            print(f"🚀 {m} {ALERT_WINDOW:.0f}s 변동 {pct:+.2f}%  현재가: {price:,.0f} KRW")
                            beep()
            except Exception as e:
                print(f"[fetch_prices_loop] error: {e}")
            await asyncio.sleep(FETCH_INTERVAL)

@app.on_event("startup")
async def on_startup():
    asyncio.create_task(fetch_prices_loop())
