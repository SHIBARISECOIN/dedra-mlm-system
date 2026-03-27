const fs = require('fs');
let code = fs.readFileSync('public/static/app.v3.js', 'utf8');

// 1. initApp 분산 로딩
const initTarget = `    updateHomeUI();
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

const initReplacement = `    // 1. 핵심 UI 로드 (즉시)
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

code = code.replace(initTarget, initReplacement);

// 2. 공지사항 리미트
const annLoadTarget = `  const { collection, query, where, getDocs, limit, db } = window.FB;
  try {
    // 단일 where만 사용 (복합 인덱스 불필요) → JS로 정렬·필터
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        // isPinned 내림차순 → createdAt 내림차순
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      })
      .slice(0, 5);`;

const annLoadReplacement = `  const { collection, query, orderBy, limit, getDocs, db } = window.FB;
  try {
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.isActive !== false)
      .sort((a, b) => {
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      })
      .slice(0, 3);`;

code = code.replace(annLoadTarget, annLoadReplacement);

// 3. 모달 전체보기 리미트
const annModalTarget = `window.showAnnouncementModal = async function() {
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });`;

const annModalReplacement = `window.showAnnouncementModal = async function() {
  const { collection, query, orderBy, getDocs, limit, db } = window.FB;
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  try {
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.isActive !== false)
      .sort((a, b) => {
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });`;

code = code.replace(annModalTarget, annModalReplacement);

// 4. 최근 거래내역 최적화
const txTarget = `    // 단일 where → JS 정렬·슬라이스 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid)
    );`;

const txReplacement = `    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      limit(50)
    );`;

code = code.replace(txTarget, txReplacement);

// 5. D-Day 카드 최적화
const ddayTarget = `    // 단일 where만 사용 → JS에서 필터·정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid)
    );`;

const ddayReplacement = `    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      limit(50)
    );`;

code = code.replace(ddayTarget, ddayReplacement);


fs.writeFileSync('public/static/app.v3.js', code);
console.log("Patched app.v3.js successfully!");
