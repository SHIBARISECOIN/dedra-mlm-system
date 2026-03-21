const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/static/app.js');
let js = fs.readFileSync(filePath, 'utf8');

// Replace everything from `async function loadTxHistory(typeFilter)` to the end of `switchTxTab`
const regex = /async function loadTxHistory\(typeFilter\)\s*\{[\s\S]*?window\.switchTxTab = function\(type, el\)\s*\{[\s\S]*?\};\n/m;

const newCode = `async function loadTxHistory(typeFilter = window.currentTxTab) {
  const { collection, query, where, getDocs, limit, db, orderBy } = window.FB;
  const listEl = document.getElementById('txHistoryList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  const dateFilterEl = document.getElementById('txDateFilter');
  const selectedDate = dateFilterEl ? dateFilterEl.value : '';

  try {
    let txs = [];
    const getSortTime = (item) => item.createdAt?.seconds || item.createdAt?.toMillis?.() / 1000 || 0;

    // Fetch Transactions (deposit, withdrawal, invest)
    if (['deposit', 'withdrawal', 'invest'].includes(typeFilter)) {
      let q;
      if (typeFilter === 'invest') {
         // for invest tab, we'll fetch both 'invest' transactions and 'daily_roi' bonuses
         q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', 'invest'), limit(100));
      } else {
         q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', typeFilter), limit(100));
      }
      const snap = await getDocs(q);
      const fetchedTxs = snap.docs.map(d => ({ id: d.id, _collection: 'transactions', ...d.data() }));
      txs = txs.concat(fetchedTxs);
      
      if (typeFilter === 'invest') {
        const invQ = query(collection(db, 'investments'), where('userId', '==', currentUser.uid), limit(100));
        const invSnap = await getDocs(invQ);
        const fetchedInvs = invSnap.docs.map(d => ({
          id: d.id,
          _collection: 'investments',
          type: 'invest',
          amount: d.data().amount,
          createdAt: d.data().createdAt || d.data().startDate,
          ...d.data()
        }));
        txs = txs.concat(fetchedInvs);
      }
    }

    // Fetch Bonuses
    let qList = [];
    if (typeFilter === 'invest') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'daily_roi'), limit(100)));
    } else if (typeFilter === 'direct_bonus') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'direct_bonus'), limit(100)));
    } else if (typeFilter === 'rank_bonus') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_bonus'), limit(100)));
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_gap_passthru'), limit(100)));
    } else if (typeFilter === 'rank_matching') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override_1pct'), limit(100)));
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override'), limit(100)));
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_matching'), limit(100)));
    } else if (typeFilter === 'center_fee') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'center_fee'), limit(100)));
    }

    for (const q of qList) {
      const snap = await getDocs(q);
      const fetchedBonuses = snap.docs.map(d => ({ id: d.id, _collection: 'bonuses', ...d.data() }));
      txs = txs.concat(fetchedBonuses);
    }

    // Apply Date Filter
    if (selectedDate) {
      const filterStart = new Date(selectedDate + 'T00:00:00').getTime() / 1000;
      const filterEnd = filterStart + 86400;
      txs = txs.filter(item => {
        const t = getSortTime(item);
        return t >= filterStart && t < filterEnd;
      });
    }

    // Sort combined list descending
    txs.sort((a, b) => getSortTime(b) - getSortTime(a));
    // txs = txs.slice(0, 100); 
    window.currentTxsData = txs; // store for download

    if (txs.length === 0) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><br>' + (t('emptyTx') || '내역이 없습니다') + '</div>';
      return;
    }

    // Unified render
    const typeLabel = {
      deposit: '⬇️ 입금', withdrawal: '⬆️ 출금', invest: '🔒 FREEZE',
      roi_income: '☀️ 데일리 이자', roi: '☀️ 데일리 이자', daily_roi: '☀️ 데일리 이자', 
      direct_bonus: '👥 추천 수당',
      rank_bonus: '🏆 직급 수당', rank_gap_passthru: '🏆 직급 수당(갭)',
      rank_equal_or_higher_override_1pct: '🛡️ 추천 매칭(1%)',
      rank_equal_or_higher_override: '🛡️ 추천 매칭',
      rank_matching: '🛡️ 추천 매칭',
      center_fee: '🏢 센터 피'
    };

    listEl.innerHTML = txs.map(item => {
      const isBonus = item._collection === 'bonuses';
      let label = typeLabel[item.type] || item.type;
      
      const dateStr = fmtDate(item.createdAt);
      let details = '';
      let base = '';
      
      if (isBonus) {
        details = item.settlementDate ? \`정산일: \${item.settlementDate}\` : (item.reason || '');
        if (item.level) label += \` · \${item.level}대\`;
        base = item.baseIncome ? \` · 기준수익: $\${fmt(item.baseIncome)}\` : (item.investAmount ? \` · FREEZE $\${fmt(item.investAmount)}\` : '');
      } else {
        if (item.type === 'invest') {
          const rate = item.dailyRate || item.roiPercent || item.dailyRoi || 0.8;
          details = \`만기: \${item.durationDays || 360}일 (\${rate}%/일) - \${item.status==='active'?'진행중':'종료'}\`;
        } else {
          details = item.status === 'pending' ? '처리중' : (item.status === 'rejected' ? '거절됨' : '완료됨');
        }
      }

      let icon = isBonus ? '💰' : (item.type === 'invest' ? '🔒' : (item.type === 'deposit' ? '⬇️' : '⬆️'));
      let iconClass = item.type;
      if (isBonus) iconClass = 'bonus';
      
      let amtSign = (item.type === 'withdrawal' || item.type === 'invest' && !isBonus) ? '-' : '+';
      let amtColor = (amtSign === '-') ? 'minus' : 'plus';
      
      return \`
      <div class="tx-item">
        <div class="tx-icon \${iconClass}">\${icon}</div>
        <div class="tx-info">
          <div class="tx-title">\${label}</div>
          <div class="tx-date">\${dateStr}\${base}</div>
          <div class="tx-date" style="font-size:10px;color:var(--text2);">\${details}</div>
        </div>
        <div>
          <div class="tx-amount \${amtColor}">\${amtSign}\${fmt(item.amount)} \${item.currency || 'USDT'}</div>
          <div class="tx-status" style="color:\${item.status==='pending' ? 'var(--yellow)' : (item.status==='rejected' ? 'var(--red)' : 'var(--green)')}">
            \${isBonus ? '완료' : (item.status === 'pending' ? '처리중' : (item.status === 'rejected' ? '거절됨' : '완료'))}
          </div>
        </div>
      </div>\`;
    }).join('');
    
  } catch (err) {
    console.error('loadTxHistory error:', err);
    if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><br>' + (t('emptyTx') || '거래 내역이 없습니다') + '</div>';
  }
}

window.currentTxTab = 'deposit';
window.switchTxTab = function(type, el) {
  window.currentTxTab = type;
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    // If no el provided, try to find it
    const tabs = document.querySelectorAll('.tx-tab');
    for(let t of tabs) {
      if(t.getAttribute('onclick').includes(type)) {
        t.classList.add('active');
        break;
      }
    }
  }
  loadTxHistory(type);
};

window.downloadTxHistory = function() {
  if (!window.currentTxsData || window.currentTxsData.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  
  let csv = '유형,날짜,금액,통화,상태,상세내용\\n';
  window.currentTxsData.forEach(item => {
    const isBonus = item._collection === 'bonuses';
    let type = item.type;
    if (isBonus) type = '보너스-' + type;
    const dateStr = fmtDate(item.createdAt);
    const amount = item.amount || 0;
    const currency = item.currency || 'USDT';
    const status = isBonus ? '완료' : (item.status === 'pending' ? '처리중' : (item.status === 'rejected' ? '거절됨' : '완료'));
    let details = item.reason || '';
    if (item.level) details += \` (\${item.level}대)\`;
    details = details.replace(/,/g, ' '); // remove commas for csv
    
    csv += \`\${type},\${dateStr},\${amount},\${currency},\${status},\${details}\\n\`;
  });
  
  const blob = new Blob(["\\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`tx_history_\${window.currentTxTab}_\${new Date().toISOString().slice(0,10)}.csv\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Add listener to date filter
document.addEventListener('DOMContentLoaded', () => {
  const dateFilterEl = document.getElementById('txDateFilter');
  if (dateFilterEl) {
    dateFilterEl.addEventListener('change', () => {
      loadTxHistory(window.currentTxTab);
    });
  }
});
`;

if (js.match(regex)) {
  js = js.replace(regex, newCode);
  fs.writeFileSync(filePath, js);
  console.log('Replaced loadTxHistory and added date filter / download functions.');
} else {
  console.log('Regex did not match.');
}
