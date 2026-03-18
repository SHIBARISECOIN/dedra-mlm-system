const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(file, 'utf8');

const target1 = `    // ── 전체 사용자 로드 (캐시) ──
    if (!_nepAllUsers || !_nepAllUsers.length) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        _nepAllUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (rulesErr) {
        console.warn('[NEP] users 로드 권한 없음:', rulesErr.message);
        _nepAllUsers = null;
      }
    }
    const allUsers = _nepAllUsers || [];`;

const target2 = `    if (!_nepAllUsers || !_nepAllUsers.length) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        _nepAllUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (rulesErr) {
        console.warn('[NEP] users 권한 없음:', rulesErr.message);
        _nepAllUsers = null;
      }
    }
    const allUsers = _nepAllUsers || [];`;

const target3 = target2; // Same for deep tab

const replacement = `    let allUsers = _nepAllUsers || [];
    if (!allUsers.length) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _nepAllUsers = allUsers;
      } catch (rulesErr) {
        console.warn('[NEP] fallback to manual recursive fetch due to rules error:', rulesErr.message);
        
        // Fallback: Recursive query for gen1, gen2, gen3
        const q1 = query(collection(db, 'users'), where('referredBy', '==', currentUser.uid));
        const snap1 = await getDocs(q1);
        const gen1 = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let gen2 = [];
        if (gen1.length > 0) {
          const gen1Ids = gen1.map(u => u.id);
          for (let i = 0; i < gen1Ids.length; i += 10) {
            const chunk = gen1Ids.slice(i, i + 10);
            const q2 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap2 = await getDocs(q2);
            gen2.push(...snap2.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        let gen3 = [];
        if (gen2.length > 0) {
          const gen2Ids = gen2.map(u => u.id);
          for (let i = 0; i < gen2Ids.length; i += 10) {
            const chunk = gen2Ids.slice(i, i + 10);
            const q3 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap3 = await getDocs(q3);
            gen3.push(...snap3.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        allUsers = [...gen1, ...gen2, ...gen3];
        _nepAllUsers = allUsers; // cache it
      }
    }`;

code = code.replace(target1, replacement);
code = code.replace(target2, replacement);
code = code.replace(target3, replacement);

fs.writeFileSync(file, code);
console.log('Injected fallback network queries');
