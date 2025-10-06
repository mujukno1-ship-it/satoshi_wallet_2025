/* config.js — 기능 토글 & 기본 설정 */
window.APP_CONFIG = {
  USE_OLD_UI: true,                 // 기존 화면 유지
  ENABLE_UPBIT_VERCEL_PROXY: true,  // 업비트 프록시 사용 (CORS 해결)
  API_BASE: "https://satoshi-wallet-2025.vercel.app",
  INTERVAL_TICKER_MS: 1500,         // 1~2초 권장
  INTERVAL_TOP_MS: 15000            // 10~30초 권장
};
