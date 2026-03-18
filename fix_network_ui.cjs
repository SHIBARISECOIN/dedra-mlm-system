const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// Replace totalDepMap logic in _loadNepGenTab (using transactions) with wallets lockedBalance
const totalDepRegex = /const totalDepMap = \{\};\s+const chunks = \[\];\s+for \([\s\S]*?totalDepMap\[data\.userId\] = \(totalDepMap\[data\.userId\] \|\| 0\) \+ \(data\.amount \|\| 0\);\s+\}\);\s+\}/m;

const newTotalDepLogic = `const totalDepMap = {}; // lockedBalance (총 매출)
    const chunks = [];
    for (let i = 0; i < memberIds.length; i += 10) chunks.push(memberIds.slice(i, i + 10));
    for (const chunk of chunks) {
      if (!chunk.length) continue;
      try {
        const wq = query(collection(db, 'wallets'), where('userId', 'in', chunk));
        const wSnap = await getDocs(wq);
        wSnap.docs.forEach(d => {
          totalDepMap[d.data().userId || d.id] = (d.data().lockedBalance || 0);
        });
      } catch (err) {}
    }`;

appJs = appJs.replace(totalDepRegex, newTotalDepLogic);

// Replace totalSales logic in _loadNepDeepTab (using investments) with wallets lockedBalance
const totalSalesRegex = /\/\/ 1\) 전체 매출 \(활성 투자금 합계\)\s+const chunks = \[\];\s+for \([\s\S]*?totalSales \+= \(data\.amountUsdt \|\| data\.amount \|\| 0\);\s+\}\);\s+\} catch\(_\) \{\}\s+\}/m;

const newTotalSalesLogic = `// 1) 전체 매출 (locked 총합)
    const chunks = [];
    for (let i = 0; i < deepIds.length; i += 10) chunks.push(deepIds.slice(i, i + 10));
    for (const chunk of chunks) {
      if (!chunk.length) continue;
      try {
        const wQ = query(collection(db, 'wallets'), where('userId', 'in', chunk));
        const wSnap = await getDocs(wQ);
        wSnap.docs.forEach(d => {
          totalSales += (d.data().lockedBalance || 0);
        });
      } catch(_) {}
    }`;

appJs = appJs.replace(totalSalesRegex, newTotalSalesLogic);

// Also replace "총 합계" with "총 매출" in the list header of _loadNepGenTab
appJs = appJs.replace(/<div style="font-size:9px;color:var\(--text3,#64748b\);font-weight:600;text-align:right;">총 합계<\/div>/g, 
  '<div style="font-size:9px;color:var(--text3,#64748b);font-weight:600;text-align:right;">총 매출</div>');

// The HTML map for totalDep uses "총 합계", let's update that if needed
// Actually, totalDep was used as totalDepMap[m.id]
// the map uses totalDep, so in HTML it will say:
// `$${fmt(totalDep)}` in the HTML.

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Network UI updated in app.js");
