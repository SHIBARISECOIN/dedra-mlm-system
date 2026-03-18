const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// 1. Fix scoping of totalRankBonusEarned in _loadNepSummary
appJs = appJs.replace(
  /let todayGen1 = 0, todayGen2 = 0, todayGen3 = 0;\n    try \{\n      const myBonusQ = query\(collection\(db, 'bonuses'\), where\('userId', '==', currentUser\.uid\)\);\n      const myBonusSnap = await getDocs\(myBonusQ\);\n      let totalRankBonusEarned = 0;/,
  `let todayGen1 = 0, todayGen2 = 0, todayGen3 = 0;
    let totalRankBonusEarned = 0;
    try {
      const myBonusQ = query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid));
      const myBonusSnap = await getDocs(myBonusQ);`
);

// 2. Fix wallets query in _loadNepGenTab
appJs = appJs.replace(
  /const \{ doc, getDoc \} = window\.FB;\n        await Promise\.all\(chunk\.map\(async uid => \{\n          try \{\n            const d = await getDoc\(doc\(db, 'wallets', uid\)\);\n            if \(d\.exists\(\)\) \{\n              totalDepMap\[uid\] = \(d\.data\(\)\.lockedBalance \|\| 0\);\n            \}\n          \} catch\(e\) \{ console\.error\("Error fetching wallet\/investment:", e\); \}\n        \}\)\);/g,
  `const wq = query(collection(db, 'wallets'), where('userId', 'in', chunk));
        const wSnap = await getDocs(wq);
        wSnap.docs.forEach(d => {
          totalDepMap[d.data().userId || d.id] = (d.data().lockedBalance || 0);
        });`
);

// 3. Fix wallets query in _loadNepDeepTab
appJs = appJs.replace(
  /const \{ doc, getDoc \} = window\.FB;\n        await Promise\.all\(chunk\.map\(async uid => \{\n          try \{\n            const d = await getDoc\(doc\(db, 'wallets', uid\)\);\n            if \(d\.exists\(\)\) \{\n              totalSales \+= \(d\.data\(\)\.lockedBalance \|\| 0\);\n            \}\n          \} catch\(e\) \{ console\.error\("Error fetching wallet\/investment:", e\); \}\n        \}\)\);/g,
  `const wQ = query(collection(db, 'wallets'), where('userId', 'in', chunk));
        const wSnap = await getDocs(wQ);
        wSnap.docs.forEach(d => {
          totalSales += (d.data().lockedBalance || 0);
        });`
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Reverted wallets query and fixed variable scope.");
