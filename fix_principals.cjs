const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function fix() {
  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.forEach(d => userMap.set(d.id, d.data()));

  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  let fixedCount = 0;
  
  for (const doc of invSnap.docs) {
    const inv = doc.data();
    const u = userMap.get(inv.userId);
    const autoCompound = u?.autoCompound || false;

    if (!autoCompound) {
      const bSnap = await db.collection('bonuses')
        .where('investmentId', '==', doc.id)
        .where('type', '==', 'roi')
        .get();
        
      let arr = [];
      bSnap.forEach(b => {
        const d = b.data();
        if (d.settlementDate) arr.push(d);
      });
      arr.sort((a,b) => b.settlementDate.localeCompare(a.settlementDate));
      
      const targetBonus = arr.find(b => b.settlementDate <= '2026-03-25');
      if (targetBonus) {
        const roiPct = inv.roiPercent || inv.dailyRoi || 0;
        if (roiPct > 0) {
          let calcPrincipal = targetBonus.amountUsdt / (roiPct / 100);
          calcPrincipal = Math.round(calcPrincipal * 1e4) / 1e4;
          
          if (Math.abs(calcPrincipal - Math.round(calcPrincipal)) < 0.01) {
            calcPrincipal = Math.round(calcPrincipal);
          }
          
          if (Math.abs(calcPrincipal - inv.amountUsdt) > 0.01) {
             console.log(`Fixing inv ${doc.id} (user ${inv.userId}): ${inv.amountUsdt} -> ${calcPrincipal}`);
             const newExpected = calcPrincipal * (roiPct / 100);
             await doc.ref.update({
               amount: calcPrincipal,
               amountUsdt: calcPrincipal,
               expectedReturn: Math.round(newExpected * 1e8) / 1e8
             });
             fixedCount++;
          }
        }
      }
    }
  }
  console.log(`Fixed ${fixedCount} investments.`);
}
fix().catch(console.error).finally(() => process.exit(0));
