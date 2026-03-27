const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `    updateHomeUI();
    loadAnnouncements();
    if (typeof loadNewsFeed === "function") loadNewsFeed();
    loadRecentTransactions();
    loadDDayCard();
    loadHomeEarn();
    startNotificationListener();
    // 홈 네트워크 수익 미리보기 로드
    setTimeout(() => _loadNepSummary && _loadNepSummary(), 800);
    // ROI 당일 정산 미실행 시 큐 등록 (백그라운드, UX 무관)
    setTimeout(() => checkAndTriggerDailyROI(), 3000);
    if (window.chatManager && typeof window.chatManager.init === "function") {
      window.chatManager.init();
    }
    // 홈 오늘 수익 카드 로드
    setTimeout(() => loadTodayEarnCard(), 1500);`;

const replacement = `    // 1. 핵심 UI 우선 로드 (즉시)
    updateHomeUI();
    loadHomeEarn();
    
    // 2. 중요도 높은 정보 로드 (짧은 지연)
    setTimeout(() => {
      loadAnnouncements();
      loadDDayCard();
      loadTodayEarnCard();
    }, 300);
    
    // 3. 서브 정보 로드 (중간 지연)
    setTimeout(() => {
      if (typeof loadNewsFeed === "function") loadNewsFeed();
      loadRecentTransactions();
      _loadNepSummary && _loadNepSummary();
    }, 800);
    
    // 4. 백그라운드 / 부가 기능 로드 (긴 지연)
    setTimeout(() => {
      startNotificationListener();
      if (window.chatManager && typeof window.chatManager.init === "function") {
        window.chatManager.init();
      }
      checkAndTriggerDailyROI();
    }, 1500);`;

if (code.includes('updateHomeUI();\n    loadAnnouncements();')) {
    code = code.replace(target, replacement);
    fs.writeFileSync('public/static/app.js', code);
    console.log("Patched initApp concurrency!");
} else {
    console.log("Target not found in initApp");
}
