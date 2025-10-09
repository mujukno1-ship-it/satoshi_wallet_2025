# exchanges_api.py — 업비트/빗썸 통합 API (타임아웃 + 재시도 + 429 대기)
import requests
import time

# 세션(연결 재사용)으로 속도/안정성 ↑
SESSION = requests.Session()
ADAPTER = requests.adapters.HTTPAdapter(pool_connections=20, pool_maxsize=20, max_retries=0)
SESSION.mount('https://', ADAPTER)
HEADERS = {"User-Agent": "SatoshiWallet/1.0 (+KRW)"}

def _get_json(url: str, timeout: int = 3, max_retry: int = 3):
    """공용 GET 함수: 타임아웃/429/일시오류 재시도"""
    for attempt in range(max_retry):
        try:
            resp = SESSION.get(url, headers=HEADERS, timeout=timeout)
            # 업비트/빗썸이 과호출 시 429 반환 → 잠깐 대기 후 재시도
            if resp.status_code == 429:
                wait = 1 + attempt  # 1s, 2s, 3s...
                print(f"⛔ 429 (요청 제한) → {wait}s 대기 후 재시도 ({attempt+1}/{max_retry})")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            return resp.json()

        except requests.exceptions.Timeout:
            print(f"⏳ 응답 지연… 재시도 ({attempt+1}/{max_retry})")
            time.sleep(1)

        except Exception as e:
            print(f"⚠️ 요청 오류: {e} (재시도 {attempt+1}/{max_retry})")
            time.sleep(1.5)

    # 모든 재시도 실패
    return None

def get_upbit_price(market: str = "KRW-BTC"):
    """
    업비트 현재가: market 예) KRW-BTC, KRW-ETH ...
    성공 시 float(원화가격), 실패 시 None
    """
    url = f"https://api.upbit.com/v1/ticker?markets={market}"
    data = _get_json(url, timeout=3, max_retry=3)
    if not data:
        return None
    try:
        return float(data[0]["trade_price"])
    except Exception:
        return None

def get_bithumb_price(symbol: str = "BTC"):
    """
    빗썸 현재가: symbol 예) BTC, ETH ...
    성공 시 float(원화가격), 실패 시 None
    """
    url = f"https://api.bithumb.com/public/ticker/{symbol}_KRW"
    data = _get_json(url, timeout=3, max_retry=3)
    if not data or data.get("status") != "0000":
        return None
    try:
        return float(data["data"]["closing_price"])
    except Exception:
        return None

def get_prices(upbit_market: str = "KRW-BTC", bithumb_symbol: str = "BTC"):
    """업비트/빗썸 동시 조회 (각 실패 시 None 반환, 무한대기 없음)"""
    upbit = get_upbit_price(upbit_market)
    bithumb = get_bithumb_price(bithumb_symbol)
    return upbit, bithumb
