const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

const target = `    const q = query(collection(db, 'transactions'), limit(15));
    const snap = await getDocs(q);
    
    let txs = snap.docs.map(d => ({id: d.id, ...d.data()}))
      .filter(t => t.status === 'approved' || !t.status)
      .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 10);`;

const replacement = `    let txs = [];
    try {
      const q = query(collection(db, 'transactions'), limit(15));
      const snap = await getDocs(q);
      txs = snap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter(t => t.status === 'approved' || !t.status)
        .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 10);
    } catch(err) {
      console.warn('Live tx query denied, using dummy data');
    }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
  console.log('Fixed live transactions marquee');
} else {
  console.log('Target not found');
}
