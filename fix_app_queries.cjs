const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// Fix wallets query for 1/2 gen
appJs = appJs.replace(
  /const wq = query\(collection\(db, 'wallets'\), where\('userId', 'in', chunk\)\);\s*const wSnap = await getDocs\(wq\);\s*wSnap\.docs\.forEach\(d => \{\s*totalDepMap\[d\.data\(\)\.userId \|\| d\.id\] = \(d\.data\(\)\.lockedBalance \|\| 0\);\s*\}\);/g,
  `const { doc, getDoc } = window.FB;
        await Promise.all(chunk.map(async uid => {
          try {
            const d = await getDoc(doc(db, 'wallets', uid));
            if (d.exists()) {
              totalDepMap[uid] = (d.data().lockedBalance || 0);
            }
          } catch(e) {}
        }));`
);

// Fix wallets query for deep gen
appJs = appJs.replace(
  /const wQ = query\(collection\(db, 'wallets'\), where\('userId', 'in', chunk\)\);\s*const wSnap = await getDocs\(wQ\);\s*wSnap\.docs\.forEach\(d => \{\s*totalSales \+= \(d\.data\(\)\.lockedBalance \|\| 0\);\s*\}\);/g,
  `const { doc, getDoc } = window.FB;
        await Promise.all(chunk.map(async uid => {
          try {
            const d = await getDoc(doc(db, 'wallets', uid));
            if (d.exists()) {
              totalSales += (d.data().lockedBalance || 0);
            }
          } catch(e) {}
        }));`
);

// Fix investments query for 1/2 gen
appJs = appJs.replace(
  /const invQ = query\(collection\(db, 'investments'\), where\('userId', 'in', chunk\), where\('status', '==', 'active'\)\);\s*const invSnap = await getDocs\(invQ\);\s*invSnap\.docs\.forEach\(d => \{\s*const data = d\.data\(\);\s*const uid = data\.userId;\s*if \(!investMap\[uid\]\) investMap\[uid\] = \[\];\s*investMap\[uid\]\.push\(data\);\s*\}\);/g,
  `const invQ = query(collection(db, 'investments'), where('userId', 'in', chunk));
        const invSnap = await getDocs(invQ);
        invSnap.docs.forEach(d => {
          const data = d.data();
          if (data.status !== 'active') return;
          const uid = data.userId || d.id;
          if (!investMap[uid]) investMap[uid] = [];
          investMap[uid].push(data);
        });`
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Updated app.js queries");
