사토시의지갑 v36 SAFE PLUS (1초 갱신)
- 기존기능 유지 + 새로운기능 추가(빗썸 프록시) + CORS 오류수정
- 업비트/빗썸 모두 1초마다 갱신 (config.js: INTERVAL_*_MS=1000)

업로드 후 테스트:
- /api/upbit?fn=markets
- /api/upbit?fn=ticker&market=KRW-BTC
- /api/upbit?fn=top&n=10
- /api/bithumb?fn=top&n=10
