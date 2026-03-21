const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

// Replace switchTxTab function
content = content.replace(
  /window\.switchTxTab = function[\s\S]*?loadTxHistory\(type\);\n\};/,
  `window.currentTxTab = 'deposit';
window.switchTxTab = function(type, el) {
  window.currentTxTab = type;
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadTxHistory();
};`
);

// We need to rewrite loadTxHistory
const regexLoad = /async function loadTxHistory\(typeFilter\) \{[\s\S]*?listEl\.innerHTML = '';\n  \}/;

const newLoad = `async function loadTxHistory(typeFilter) {
  const type = typeFilter || window.currentTxTab || 'deposit';
  window.currentTxTab = type;
  
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const listEl = document.getElementById('txHistoryList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    let txs = [];
    const getSortTime = (item) => item.createdAt?.seconds || item.createdAt?.toMillis?.() / 1000 || 0;

    // Filter by date if datePicker is used
    const datePicker = document.getElementById('txDateFilter');
    const selectedDate = datePicker && datePicker.value ? new Date(datePicker.value) : null;
    let startOfDay, endOfDay;
    if (selectedDate) {
      startOfDay = new Date(selectedDate);
      startOfDay.setHours(0,0,0,0);
      endOfDay = new Date(selectedDate);
      endOfDay.setHours(23,59,59,999);
    }

    // Prepare queries
    let qList = [];
    if (type === 'deposit' || type === 'withdrawal') {
      qList = [query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', type), limit(100))];
    } else if (type === 'roi') {
      qList = [query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'daily_roi'), limit(100))];
    } else if (type === 'direct_bonus') {
      qList = [query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'direct_bonus'), limit(100))];
    } else if (type === 'rank_bonus') {
      qList = [
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_bonus'), limit(50)),
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_gap_passthru'), limit(50))
      ];
    } else if (type === 'rank_matching') {
      qList = [
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override'), limit(50)),
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override_1pct'), limit(50)),
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_matching'), limit(50))
      ];
    } else if (type === 'center_fee') {
      qList = [query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'center_fee'), limit(100))];
    }

    for (const q of qList) {
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      txs = txs.concat(fetched);
    }

    // Add backwards compatibility for 'roi' vs 'daily_roi'
    if (type === 'roi') {
      const q2 = query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'roi'), limit(100));
      const snap2 = await getDocs(q2);
      const fetched2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      txs = txs.concat(fetched2);
    }

    // Filter by date
    if (selectedDate) {
      txs = txs.filter(tx => {
        let ts = getSortTime(tx) * 1000;
        if (!ts && typeof tx.createdAt === 'string') ts = new Date(tx.createdAt).getTime();
        if (!ts) return false;
        return ts >= startOfDay.getTime() && ts <= endOfDay.getTime();
      });
    }

    // Remove duplicates by id
    const uniqueMap = new Map();
    txs.forEach(t => uniqueMap.set(t.id, t));
    txs = Array.from(uniqueMap.values());

    // Sort combined list descending
    txs.sort((a, b) => {
        let timeA = getSortTime(a);
        if (!timeA && typeof a.createdAt === 'string') timeA = new Date(a.createdAt).getTime() / 1000;
        let timeB = getSortTime(b);
        if (!timeB && typeof b.createdAt === 'string') timeB = new Date(b.createdAt).getTime() / 1000;
        return timeB - timeA;
    });

    window.currentTxData = txs; // store for download

    if (txs.length === 0) {
      listEl.innerHTML = '<div class="empty-state">내역이 없습니다.</div>';
      return;
    }
    
    listEl.innerHTML = '';
  }`;

content = content.replace(regexLoad, newLoad);
fs.writeFileSync(file, content, 'utf8');
console.log("loadTxHistory replaced.");
