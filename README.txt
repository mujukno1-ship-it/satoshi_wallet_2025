사토시의지갑 v36 — 업비트 연동(기존기능 유지 + 새로운기능 + 오류수정)
========================================================

폴더 구조
---------
/api/upbit.js
/config.js
/index.html
/style.css (선택)

사용 방법 (깃허브 웹으로 업로드)
--------------------------------
1) 저장소 열기 → 'Add file' → 'Upload files'
2) 이 폴더의 파일들을 모두 드래그앤드롭
3) 'Commit changes' 클릭
4) Vercel이 자동 배포되면 아래 주소들 확인
   - https://satoshi-wallet-2025.vercel.app/api/upbit?fn=markets
   - https://satoshi-wallet-2025.vercel.app/api/upbit?fn=ticker&market=KRW-BTC
   - https://satoshi-wallet-2025.vercel.app/api/upbit?fn=top&n=10

주의
----
- 기존 기능은 유지되며, 새 기능은 config.js 토글로 제어합니다.
- 업비트 직접 호출은 브라우저 CORS로 막히니 반드시 /api/upbit 프록시 경로를 사용하세요.
