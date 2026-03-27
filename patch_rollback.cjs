const fs = require('fs');
const path = '/home/user/webapp/src/index.tsx';
let code = fs.readFileSync(path, 'utf8');

const startIndex = code.indexOf("app.post('/api/admin/rollback-settlement'");
const endIndex = code.indexOf("app.get('/api/admin/check-reconstruct'");

if (startIndex !== -1 && endIndex !== -1) {
  const newEndpoint = `app.post('/api/admin/rollback-settlement', async (c) => {
  try {
    const body = await c.req.json();
    if (body.secret !== 'deedra-cron-2026') return c.json({ error: '인증 실패' }, 401);
    const targetDate = body.targetDate || "2026-03-26";
    
    const adminToken = await getAdminToken();
    
    // 1. Get bonuses for the target date
    const bonuses = await fsQuery('bonuses', adminToken, [
      { fieldFilter: { field: { fieldPath: 'settlementDate' }, op: 'EQUAL', value: { stringValue: targetDate } } }
    ], 100000);
    
    console.log("Found bonuses to rollback:", bonuses.length);
    
    const allUsers = await fsQuery('users', adminToken, [], 100000);
    const allWallets = await fsQuery('wallets', adminToken, [], 100000);
    const allInvs = await fsQuery('investments', adminToken, [], 100000);
    
    const userMap = new Map(allUsers.map((u: any) => [u.id || u.uid, u]));
    const wMap = new Map(allWallets.map((w: any) => [w.id || w.userId, w]));
    const invMap = new Map(allInvs.map((i: any) => [i.id, i]));
    
    // 2. Compute wallet deltas
    const userWalletsDelta = {};
    const invReversals = {};
    
    for (const b of bonuses) {
      if (!userWalletsDelta[b.userId]) {
        userWalletsDelta[b.userId] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0 };
      }
      const d = userWalletsDelta[b.userId];
      d.totalEarnings += (b.amountUsdt || 0);

      if (b.type === 'roi') {
        const u = userMap.get(b.userId);
        const autoCompound = u?.autoCompound || false;
        
        if (autoCompound) {
          d.totalInvest += (b.amountUsdt || 0);
        } else {
          d.bonusBalance += (b.amountUsdt || 0);
        }
        if (b.investmentId) {
          invReversals[b.investmentId] = (invReversals[b.investmentId] || 0) + (b.amountUsdt || 0);
        }
      } else {
        d.bonusBalance += (b.amountUsdt || 0);
      }
    }
    
    const writes = [];
    
    // 3. Prepare Investment reverts
    let invRevertedCount = 0;
    for (const [invId, amountToSub] of Object.entries(invReversals)) {
      const inv = invMap.get(invId);
      if (inv) {
        const newAmount = Math.max(0, (inv.amountUsdt || 0) - amountToSub);
        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        const newExpectedReturn = newAmount * (dailyRoiPct / 100);
        
        const prevDateObj = new Date(targetDate + "T00:00:00Z");
        prevDateObj.setDate(prevDateObj.getDate() - 1);
        const prevDate = prevDateObj.toISOString().slice(0,10);
        
        writes.push({
          update: {
            name: \`projects/dedra-mlm/databases/(default)/documents/investments/\${invId}\`,
            fields: {
              amount: toFirestoreValue(newAmount),
              amountUsdt: toFirestoreValue(newAmount),
              expectedReturn: toFirestoreValue(newExpectedReturn),
              paidRoi: toFirestoreValue(Math.max(0, (inv.paidRoi || 0) - amountToSub)),
              lastSettledAt: toFirestoreValue(\`\${prevDate}T23:59:59.000Z\`)
            }
          },
          updateMask: { fieldPaths: ['amount', 'amountUsdt', 'expectedReturn', 'paidRoi', 'lastSettledAt'] }
        });
        invRevertedCount++;
      }
    }
    
    // 4. Prepare Wallet reverts
    let walletRevertedCount = 0;
    for (const [userId, delta] of Object.entries(userWalletsDelta)) {
      const w = wMap.get(userId);
      if (w) {
        const newBonus = Math.max(0, (w.bonusBalance || 0) - delta.bonusBalance);
        const newTotalE = Math.max(0, (w.totalEarnings || 0) - delta.totalEarnings);
        const newTotalI = Math.max(0, (w.totalInvest || w.totalInvested || 0) - delta.totalInvest);
        
        writes.push({
          update: {
            name: \`projects/dedra-mlm/databases/(default)/documents/wallets/\${userId}\`,
            fields: {
              bonusBalance: toFirestoreValue(newBonus),
              totalEarnings: toFirestoreValue(newTotalE),
              totalInvest: toFirestoreValue(newTotalI)
            }
          },
          updateMask: { fieldPaths: ['bonusBalance', 'totalEarnings', 'totalInvest'] }
        });
        walletRevertedCount++;
      }
    }
    
    // 5. Delete Bonuses
    let deletedBonuses = 0;
    for (const b of bonuses) {
      writes.push({
        delete: \`projects/dedra-mlm/databases/(default)/documents/bonuses/\${b.id}\`
      });
      deletedBonuses++;
    }
    
    // 6. Execute Batch Writes in chunks
    console.log(\`Ready to batch \${writes.length} writes...\`);
    for (let i = 0; i < writes.length; i += 500) {
      await fsBatchCommit(writes.slice(i, i + 500), adminToken);
    }
    
    // 7. Delete Settlement Lock
    await fetch(\`\${FIRESTORE_BASE}/settlements/\${targetDate}\`, {
      method: 'DELETE',
      headers: { 'Authorization': \`Bearer \${adminToken}\` }
    });

    return c.json({ 
      success: true, 
      message: \`\${targetDate} 정산이 롤백되었습니다.\`,
      invRevertedCount, 
      walletRevertedCount, 
      deletedBonuses 
    });
  } catch(e: any) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
})

`;
  code = code.slice(0, startIndex) + newEndpoint + code.slice(endIndex);
  fs.writeFileSync(path, code);
  console.log("Patched rollback-settlement again for bulk!");
} else {
  console.log("Could not find start/end bounds.");
}
