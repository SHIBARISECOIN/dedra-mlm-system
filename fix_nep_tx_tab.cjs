const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(file, 'utf8');

const target = `    // 단일 where만 사용 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));`;

const replacement = `    // 단일 where만 사용
    const qTx = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), limit(30));
    const qBonus = query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), limit(30));
    
    const [snapTx, snapBonus] = await Promise.all([getDocs(qTx), getDocs(qBonus)]);
    
    let allData = [
      ...snapTx.docs.map(d => ({ id: d.id, ...d.data() })),
      ...snapBonus.docs.map(d => ({ id: d.id, ...d.data(), isBonus: true }))
    ];
    
    // 네트워크 수익 관련 항목만 필터링 (선택적)
    // tx는 출금/입금, bonus는 추천매칭, 판권매칭 등
    const txs = allData.sort((a, b) => {
      const aTime = a.createdAt?.seconds || (new Date(a.settlementDate||0).getTime()/1000) || 0;
      const bTime = b.createdAt?.seconds || (new Date(b.settlementDate||0).getTime()/1000) || 0;
      return bTime - aTime;
    });`;

code = code.replace(target, replacement);

const target2 = `    const icons = { deposit: '⬇️', withdrawal: '⬆️', bonus: '🎁', invest: '📈', game: '🎮' };`;
const replacement2 = `    const icons = { deposit: '⬇️', withdrawal: '⬆️', bonus: '🎁', invest: '📈', game: '🎮', direct_bonus: '👥', rank_bonus: '🏆', rank_gap_passthru: '🛡️', daily_roi: '☀️' };`;
code = code.replace(target2, replacement2);

fs.writeFileSync(file, code);
console.log('Fixed _loadNepTxTab');
