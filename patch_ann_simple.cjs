const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target1 = `  const { collection, query, where, getDocs, limit, db } = window.FB;
  try {
    // 단일 where만 사용 (복합 인덱스 불필요) → JS로 정렬·필터
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true)
    );`;

const replacement1 = `  const { collection, query, orderBy, limit, getDocs, db } = window.FB;
  try {
    // 공지사항 전체 로딩 방지: 최근 15개만 가져와서 클라이언트에서 필터링
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );`;

const target2 = `    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {`;

const replacement2 = `    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.isActive !== false) // 클라이언트 필터링
      .sort((a, b) => {`;

const target3 = `.slice(0, 5);`;
const replacement3 = `.slice(0, 3);`; // 3개만 표시

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
code = code.replace(target3, replacement3);


// Full Modal 로딩 쿼리 교체
const targetModal = `window.showAnnouncementModal = async function() {
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  
  const { collection, query, where, getDocs, db } = window.FB;
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true)
    );`;

const replacementModal = `window.showAnnouncementModal = async function() {
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  
  const { collection, query, orderBy, limit, getDocs, db } = window.FB;
  try {
    // 모달에서는 최근 30개만
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );`;

const targetModalFilter = `    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {`;

const replacementModalFilter = `    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.isActive !== false)
      .sort((a, b) => {`;

// We use replace again, it might hit the first one or second one.
// Let's replace specifically inside showAnnouncementModal
const chunks = code.split('window.showAnnouncementModal');
if (chunks.length > 1) {
    let secondChunk = chunks[1];
    secondChunk = secondChunk.replace(targetModalFilter.trim(), replacementModalFilter.trim());
    code = chunks[0] + 'window.showAnnouncementModal' + secondChunk;
}
code = code.replace(targetModal, replacementModal);


fs.writeFileSync('public/static/app.js', code);
console.log("Patched loadAnnouncements!");
