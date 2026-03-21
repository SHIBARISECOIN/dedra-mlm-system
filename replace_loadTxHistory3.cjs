const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /async function loadTxHistory\(typeFilter\) \{[\s\S]*?\}\n\n\/\/ ===== 입금 신청 =====/;

const replacement = `async function loadTxHistory(typeFilter) {
  const type = typeFilter || window.currentTxTab || 'deposit';
  window.currentTxTab = type;
  
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const listEl = document.getElementById('txHistoryList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    let txs = [];
    const getSortTime = (item) => item.createdAt?.seconds || item.createdAt?.toMillis?.() / 1000 || 0;

    const datePicker = document.getElementById('txDateFilter');
    if (datePicker && !datePicker.value) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      datePicker.value = \`\${yyyy}-\${mm}-\${dd}\`;
    }
    
    const selectedDate = datePicker && datePicker.value ? new Date(datePicker.value) : null;
    let startOfDay, endOfDay;
    if (selectedDate) {
      startOfDay = new Date(selectedDate);
      startOfDay.setHours(0,0,0,0);
      endOfDay = new Date(selectedDate);
      endOfDay.setHours(23,59,59,999);
    }

    let qList = [];
    if (type === 'deposit' || type === 'withdrawal') {
      qList = [query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', type), limit(200))];
    } else if (type === 'roi' || type === 'invest') {
      qList = [
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'daily_roi'), limit(200)),
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'roi'), limit(200))
      ];
    } else if (type === 'direct_bonus') {
      qList = [query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'direct_bonus'), limit(200))];
    } else if (type === 'rank_bonus') {
      qList = [
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_bonus'), limit(100)),
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_gap_passthru'), limit(100))
      ];
    } else if (type === 'rank_matching' || type === 'matching') {
      qList = [
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override'), limit(100)),
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override_1pct'), limit(100)),
        query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_matching'), limit(100))
      ];
    } else if (type === 'center_fee' || type === 'centerFee') {
      qList = [query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'center_fee'), limit(200))];
    }

    for (const q of qList) {
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      txs = txs.concat(fetched);
    }

    if (selectedDate) {
      txs = txs.filter(tx => {
        let ts = getSortTime(tx) * 1000;
        if (!ts && typeof tx.createdAt === 'string') ts = new Date(tx.createdAt).getTime();
        if (!ts) return false;
        return ts >= startOfDay.getTime() && ts <= endOfDay.getTime();
      });
    }

    const uniqueMap = new Map();
    txs.forEach(t => uniqueMap.set(t.id, t));
    txs = Array.from(uniqueMap.values());

    txs.sort((a, b) => {
        let timeA = getSortTime(a);
        if (!timeA && typeof a.createdAt === 'string') timeA = new Date(a.createdAt).getTime() / 1000;
        let timeB = getSortTime(b);
        if (!timeB && typeof b.createdAt === 'string') timeB = new Date(b.createdAt).getTime() / 1000;
        return timeB - timeA;
    });

    window.currentTxData = txs;

    if (txs.length === 0) {
      if (listEl) listEl.innerHTML = '<div class="empty-state">내역이 없습니다.</div>';
      return;
    }
    
    let html = '';
    txs.forEach(item => {
      let icon = 'fas fa-exchange-alt';
      let iconColor = '#94a3b8';
      let bgClass = '';
      let amtColor = '#e2e8f0';
      let title = '거래';
      let sign = '';
      let amt = parseFloat(item.amountUsdt || item.amount || 0);
      let statusHtml = '';
      let subText = item.reason || '';

      const isDeposit = item.type === 'deposit';
      const isWithdrawal = item.type === 'withdrawal';
      const isBonus = !isDeposit && !isWithdrawal;

      if (isDeposit) {
        icon = 'fas fa-arrow-down';
        iconColor = '#10b981';
        bgClass = 'bg-deposit';
        amtColor = '#10b981';
        title = 'USDT 입금';
        sign = '+';
      } else if (isWithdrawal) {
        icon = 'fas fa-arrow-up';
        iconColor = '#ef4444';
        bgClass = 'bg-withdrawal';
        amtColor = '#ef4444';
        title = 'USDT 출금';
        sign = '-';
      } else {
        icon = 'fas fa-gift';
        iconColor = '#f59e0b';
        bgClass = 'bg-bonus';
        amtColor = '#10b981';
        sign = '+';
        if (item.type === 'daily_roi' || item.type === 'roi') title = 'FREEZE 수익';
        else if (item.type === 'direct_bonus') title = '추천 수당';
        else if (item.type === 'rank_bonus' || item.type.includes('passthru')) title = '직급 수당';
        else if (item.type.includes('matching') || item.type.includes('override')) title = '추천 매칭';
        else if (item.type === 'center_fee') title = '센터 피';
        else title = '보너스';
      }

      if (item.status === 'pending') {
        statusHtml = '<span style="color:#f59e0b;font-size:11px;">대기중</span>';
      } else if (item.status === 'approved' || isBonus) {
        statusHtml = '<span style="color:#10b981;font-size:11px;">완료</span>';
      } else if (item.status === 'rejected') {
        statusHtml = '<span style="color:#ef4444;font-size:11px;">거절됨</span>';
      }

      let dateStr = '';
      try {
        let ts = getSortTime(item);
        if (!ts && typeof item.createdAt === 'string') ts = new Date(item.createdAt).getTime() / 1000;
        const d = new Date(ts * 1000);
        dateStr = d.toLocaleString('ko-KR', {
            year:'2-digit', month:'2-digit', day:'2-digit',
            hour:'2-digit', minute:'2-digit'
        });
      } catch (e) {}

      html += \`
        <div class="tx-item">
          <div class="tx-icon \${bgClass}"><i class="\${icon}" style="color:\${iconColor}"></i></div>
          <div class="tx-info">
            <div class="tx-title">\${title} \${item.network === 'solana' ? '<span style="font-size:10px;background:#14f195;color:#000;padding:1px 4px;border-radius:4px;margin-left:4px;">Solana</span>' : ''}</div>
            <div class="tx-date">\${dateStr}</div>
            \${subText ? \`<div style="font-size:11px; color:#94a3b8; margin-top:2px;">\${subText}</div>\` : ''}
          </div>
          <div class="tx-amount">
            <div style="color:\${amtColor}; font-weight:700;">\${sign}\${amt.toLocaleString(undefined, {maximumFractionDigits:2})} USDT</div>
            <div style="text-align:right; margin-top:4px;">\${statusHtml}</div>
          </div>
        </div>
      \`;
    });
    
    if (listEl) listEl.innerHTML = html;
  } catch (err) {
    console.error('loadTxHistory error:', err);
    if (listEl) listEl.innerHTML = '<div class="empty-state">내역을 불러오지 못했습니다.</div>';
  }
}

// ===== 입금 신청 =====`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log("loadTxHistory replaced successfully.");
} else {
  console.log("Regex still not matching.");
}
