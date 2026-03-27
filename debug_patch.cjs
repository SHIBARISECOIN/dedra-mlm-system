const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const earnLoad = `// ===== 홈 EARN 패널 - 상품 미리보기 로드 =====
async function loadHomeEarn() {
  setTimeout(window.initLiveTransactionMarquee, 500);
  const listEl = document.getElementById('homeEarnList');
  if (!listEl) return;`;

const earnDebug = `// ===== 홈 EARN 패널 - 상품 미리보기 로드 =====
async function loadHomeEarn() {
  setTimeout(window.initLiveTransactionMarquee, 500);
  const listEl = document.getElementById('homeEarnList');
  if (!listEl) return;
  listEl.innerHTML += '<div style="color:yellow;font-size:10px;">Debug: init</div>';`;

code = code.replace(earnLoad, earnDebug);

const annLoad = `async function loadAnnouncements() {
  const { collection, query, orderBy, limit, getDocs, db } = window.FB;
  try {`;

const annDebug = `async function loadAnnouncements() {
  const { collection, query, orderBy, limit, getDocs, db } = window.FB;
  const listEl = document.getElementById('announcementList');
  if (listEl) listEl.innerHTML += '<div style="color:yellow;font-size:10px;">Debug: ann init</div>';
  try {`;

code = code.replace(annLoad, annDebug);

fs.writeFileSync('public/static/app.js', code);
