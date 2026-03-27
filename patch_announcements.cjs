const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// Patch loadAnnouncements
const annLoadTarget = `    // 단일 where만 사용 (복합 인덱스 불필요) → JS로 정렬·필터
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
      });`;

const annLoadReplacement = `    const { orderBy, limit } = window.FB;
    // 복합 인덱스 오류 방지를 위해 최근 10개만 가져와서 클라이언트에서 필터링
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.isActive !== false) // isActive가 명시적으로 false가 아닌 것만 (기본적으로 노출)
      .sort((a, b) => {
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });`;

code = code.replace(annLoadTarget, annLoadReplacement);

// Patch showAnnouncementModal query as well
const annModalTarget = `  const { collection, query, where, getDocs, db } = window.FB;
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

const annModalReplacement = `  const { collection, query, where, getDocs, db, orderBy, limit } = window.FB;
  try {
    // 전체 보기를 누르면 최근 30개만 가져옵니다
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

fs.writeFileSync('public/static/app.js', code);
console.log("Patched announcements query!");
