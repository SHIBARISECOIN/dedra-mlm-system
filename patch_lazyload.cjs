const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

// 1. 공지사항 로딩 개선: 메인화면에는 최대 3개만, 전체보기(Modal) 시에만 전체 조회하도록 수정
// 그리고 캐싱 도입
const announcementMod1 = `async function loadAnnouncements() {
  const { collection, query, where, getDocs, db } = window.FB;
  try {
    // If already cached, just render first 3
    if (window._cachedAnnouncements && window._cachedAnnouncements.length > 0) {
      renderAnnouncements(window._cachedAnnouncements.slice(0, 3), 'announcementList');
      renderAnnouncements(window._cachedAnnouncements.slice(0, 3), 'moreAnnouncementList');
      return;
    }
    
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
      });
      
    window._cachedAnnouncements = items;
    
    // Main 화면에는 3개만 렌더링
    renderAnnouncements(items.slice(0, 3), 'announcementList');
    renderAnnouncements(items.slice(0, 3), 'moreAnnouncementList');
  } catch (err) {
    console.error('[announcements] load error:', err);
    if (err && err.code) { document.getElementById('announcementList').innerHTML = \`<div class="empty-state" style="color:red">\${err.message}</div>\`; return; }
    const el = document.getElementById('announcementList');
    if (el) el.innerHTML = \`<div class="empty-state">\${t('emptyNotice')}</div>\`;
  }
}`;

appJs = appJs.replace(/async function loadAnnouncements\(\) \{[\s\S]*?renderAnnouncements\(items, 'moreAnnouncementList'\);\s*\} catch \(err\) \{[\s\S]*?\}\s*\}/, announcementMod1);

// 2. 공지사항 전체보기 모달 최적화
const announcementMod2 = `window.showAnnouncementModal = async function() {
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  
  if (window._cachedAnnouncements && window._cachedAnnouncements.length > 0) {
    renderAnnouncements(window._cachedAnnouncements, 'announcementFullList');
    return;
  }
  
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  
  const { collection, query, where, getDocs, db } = window.FB;
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
      });
    
    window._cachedAnnouncements = items;
    renderAnnouncements(items, 'announcementFullList');
  } catch {
    if (listEl) listEl.innerHTML = \`<div class="empty-state">\${t('loadFail') || '불러오기 실패'}</div>\`;
  }
};`;

appJs = appJs.replace(/window\.showAnnouncementModal = async function\(\) \{[\s\S]*?renderAnnouncements\(items, 'announcementFullList'\);\s*\} catch \{[\s\S]*?\}\s*\};/, announcementMod2);

fs.writeFileSync('public/static/app.js', appJs);
console.log('patched lazyload and caching logic');
