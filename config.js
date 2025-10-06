/* config.js — 기능 토글 & 기본 설정 (기존 유지 + 새 기능 안전 스위치, 1초 갱신) */
window.APP_CONFIG = {
  USE_OLD_UI: true,                  // 기존 화면 유지
  ENABLE_UPBIT_VERCEL_PROXY: true,   // 업비트 프록시 사용 (CORS 해결)
  ENABLE_BITHUMB_VERCEL_PROXY: true, // 빗썸 프록시 사용 (CORS 해결)
  API_BASE: "https://satoshi-wallet-2025.vercel.app",
  INTERVAL_TICKER_MS: 1000,          // ✅ 1초
  INTERVAL_TOP_MS: 1000              // ✅ 1초
};
