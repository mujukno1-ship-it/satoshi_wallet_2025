// 사토시의지갑 — 테스트 모드 (결제창 생략 버전)
document.getElementById("payBtn").addEventListener("click", () => {
  alert("🧪 테스트 모드: 결제창은 생략되고 성공 페이지로 이동합니다.");
  window.location.href = "success.html";
});
