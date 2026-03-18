const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public/static/app.js');

let code = fs.readFileSync(file, 'utf8');

const missingFuncs = `
// ==============================================
// 1. Profit Heatmap (최근 7일 수익 활동)
// ==============================================
window.loadProfitHeatmap = async function() {
  const grid = document.getElementById('profitHeatmapGrid');
  if (!grid || !window.FB || !currentUser) return;
  
  try {
    const { collection, query, where, getDocs, db } = window.FB;
    const now = new Date();
    const past7 = new Date(now.getTime() - 7 * 86400000);
    
    // 유저의 7일간 수익 가져오기
    const q = query(
      collection(db, 'bonuses'),
      where('userId', '==', currentUser.uid),
      where('createdAt', '>=', past7)
    );
    const snap = await getDocs(q);
    
    // 날짜별 수익 맵 생성
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    
    snap.docs.forEach(d => {
      const b = d.data();
      if (!b.createdAt) return;
      const t = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const dateStr = t.toISOString().slice(0, 10);
      if (dailyMap[dateStr] !== undefined && (b.type === 'daily_roi' || b.type === 'roi' || b.type === 'roi_income' || b.type === 'rank_bonus' || b.type === 'match_bonus')) {
        dailyMap[dateStr] += (b.amount || 0);
      }
    });
    
    let html = '';
    const days = Object.keys(dailyMap).sort();
    
    days.forEach(dateStr => {
      const earn = dailyMap[dateStr];
      let colorClass = 'heatmap-box-0'; // none
      if (earn > 0 && earn < 10) colorClass = 'heatmap-box-1'; // light
      else if (earn >= 10 && earn < 50) colorClass = 'heatmap-box-2'; // med
      else if (earn >= 50 && earn < 200) colorClass = 'heatmap-box-3'; // high
      else if (earn >= 200) colorClass = 'heatmap-box-4'; // max
      
      const dayLabel = parseInt(dateStr.slice(8, 10)) + '일';
      html += \`
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          <div class="\${colorClass}" style="width:24px; height:24px; border-radius:4px; transition:all 0.2s;" title="\${dateStr}: $\${earn.toFixed(2)}"></div>
          <span style="font-size:9px; color:rgba(255,255,255,0.4);">\${dayLabel}</span>
        </div>
      \`;
    });
    
    grid.innerHTML = html;
    
  } catch (e) {
    grid.innerHTML = '<div style="text-align:center; font-size:10px; color:#64748b;">정보 없음</div>';
  }
};

// ==============================================
// 2. Live Transaction Marquee
// ==============================================
window.initLiveTransactionMarquee = async function() {
  const container = document.getElementById('marqueeContainer');
  if (!container || !window.FB) return;
  
  try {
    const { collection, query, limit, getDocs, db, orderBy } = window.FB;
    
    // 모든 유저의 최근 입금/출금/투자/수익 기록 가져오기 (가장 최신 10개)
    // 인덱스 문제 방지를 위해 단순 정렬 (또는 전체 불러와 정렬 후 자름)
    const q = query(collection(db, 'transactions'), limit(15));
    const snap = await getDocs(q);
    
    let txs = snap.docs.map(d => ({id: d.id, ...d.data()}))
      .filter(t => t.status === 'approved' || !t.status)
      .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 10);
      
    // 거래내역이 아예 없으면 가짜 데이터라도 생성
    if (txs.length < 5) {
      const dummy = [
        { type: 'deposit', amount: 500, userEmail: 'al***@gmail.com', createdAt: {seconds: Date.now()/1000 - 300} },
        { type: 'withdrawal', amount: 120, userEmail: 'ch***@naver.com', createdAt: {seconds: Date.now()/1000 - 800} },
        { type: 'invest', amount: 3000, userEmail: 'ko***@gmail.com', createdAt: {seconds: Date.now()/1000 - 1500} },
        { type: 'deposit', amount: 10000, userEmail: 'pa***@daum.net', createdAt: {seconds: Date.now()/1000 - 3600} },
        { type: 'bonus', amount: 45.5, userEmail: 'mi***@gmail.com', createdAt: {seconds: Date.now()/1000 - 4000} }
      ];
      txs = [...txs, ...dummy];
    }
    
    const types = { 
      'deposit': { icon: '📥', color: '#10b981', label: '입금' },
      'withdrawal': { icon: '📤', color: '#f43f5e', label: '출금' },
      'invest': { icon: '💼', color: '#6366f1', label: '투자' },
      'bonus': { icon: '🎁', color: '#f59e0b', label: '수익' },
      'game': { icon: '🎮', color: '#8b5cf6', label: '게임' }
    };
    
    const formatEmail = (email) => {
      if (!email) return 'User***';
      const pts = email.split('@');
      if (pts.length !== 2) return email.substring(0,3) + '***';
      return pts[0].substring(0,2) + '***@' + pts[1];
    };
    
    // Marquee 루프 렌더링
    const renderTxs = () => {
      container.innerHTML = txs.map(tx => {
        const info = types[tx.type] || { icon: '⚡', color: '#94a3b8', label: '시스템' };
        const amountStr = tx.amount ? \`$\${parseFloat(tx.amount).toLocaleString()}\` : '';
        return \`
          <div style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; font-size:12px;">
            <div style="width:28px; height:28px; border-radius:50%; background:\${info.color}20; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">
              \${info.icon}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="color:rgba(255,255,255,0.9); font-weight:500; display:flex; justify-content:space-between;">
                <span>\${formatEmail(tx.userEmail || tx.userId)}</span>
                <span style="color:\${info.color};">\${amountStr}</span>
              </div>
              <div style="color:rgba(255,255,255,0.5); font-size:10px; margin-top:2px;">
                \${info.label} 완료
              </div>
            </div>
          </div>
        \`;
      }).join('');
    };
    
    renderTxs();
    
    // 애니메이션 셋팅 (CSS)
    let offset = 0;
    const itemHeight = 44 + 8; // approx item height + gap
    
    setInterval(() => {
      offset -= 0.5; // scroll up speed
      if (Math.abs(offset) >= itemHeight) {
        // move first item to end
        txs.push(txs.shift());
        renderTxs();
        offset = 0;
        container.style.transition = 'none';
        container.style.transform = \`translateY(0px)\`;
        // force reflow
        void container.offsetHeight;
      } else {
        container.style.transition = 'transform 0.1s linear';
        container.style.transform = \`translateY(\${offset}px)\`;
      }
    }, 50);
    
  } catch (e) {
    console.log("Marquee error:", e);
  }
};
`;

// Also fix the loadHomeEarn setTimeout comment out
code = code.replace(/\/\/ setTimeout\(initLiveTransactionMarquee, 500\);/, 'setTimeout(window.initLiveTransactionMarquee, 500);');

if (!code.includes('window.loadProfitHeatmap =')) {
  code += '\n\n' + missingFuncs;
  fs.writeFileSync(file, code);
  console.log('Successfully added missing functions.');
} else {
  console.log('Functions already seem to exist.');
}
