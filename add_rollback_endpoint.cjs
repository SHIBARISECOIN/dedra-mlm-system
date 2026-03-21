const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const rollbackEndpoint = `
app.post('/api/admin/rollback-settlement', async (c) => {
  try {
    const body = await c.req.json();
    if (body.secret !== CRON_SECRET) return c.json({ error: '인증 실패' }, 401);
    
    const adminToken = await getAdminToken();
    const todayPrefix = "2026-03-20";

    const bonuses = await fsQuery('bonuses', adminToken);
    const todayBonuses = bonuses.filter(b => b.createdAt && b.createdAt.startsWith(todayPrefix));
    
    const userWalletsDelta = {}; 
    const invReversals = {}; 
    
    const users = await fsQuery('users', adminToken);
    const userMap = new Map(users.map(u => [u.id, u]));

    for (const b of todayBonuses) {
      if (!userWalletsDelta[b.userId]) {
        userWalletsDelta[b.userId] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0 };
      }
      const d = userWalletsDelta[b.userId];
      d.totalEarnings += b.amountUsdt;

      if (b.type === 'roi') {
        const u = userMap.get(b.userId);
        if (u && u.autoCompound) {
          d.totalInvest += b.amountUsdt;
        } else {
          d.bonusBalance += b.amountUsdt;
        }
        if (b.investmentId) {
          invReversals[b.investmentId] = (invReversals[b.investmentId] || 0) + b.amountUsdt;
        }
      } else {
        d.bonusBalance += b.amountUsdt;
      }
    }

    let invRevertedCount = 0;
    const invPromises = [];
    for (const [invId, amountToSub] of Object.entries(invReversals)) {
      const inv = await fsGet(\`investments/\${invId}\`, adminToken);
      if (inv) {
        const newAmount = Math.max(0, (inv.amountUsdt || 0) - amountToSub);
        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        const newExpectedReturn = newAmount * (dailyRoiPct / 100);
        
        invPromises.push(fsPatch(\`investments/\${invId}\`, {
          amount: newAmount,
          amountUsdt: newAmount,
          expectedReturn: newExpectedReturn,
          paidRoi: Math.max(0, (inv.paidRoi || 0) - amountToSub),
          lastSettledAt: "2026-03-19T23:59:59.000Z" 
        }, adminToken));
        invRevertedCount++;
      }
    }
    // Batch process to avoid timeouts
    for (let i = 0; i < invPromises.length; i += 20) {
      await Promise.all(invPromises.slice(i, i + 20));
    }

    const wallets = await fsQuery('wallets', adminToken);
    const walletMap = new Map(wallets.map(w => [w.id, w])); 
    let walletRevertedCount = 0;
    const walletPromises = [];

    for (const [userId, delta] of Object.entries(userWalletsDelta)) {
      const w = walletMap.get(userId);
      if (w) {
        walletPromises.push(fsPatch(\`wallets/\${userId}\`, {
          bonusBalance: Math.max(0, (w.bonusBalance || 0) - delta.bonusBalance),
          totalInvest: Math.max(0, (w.totalInvest || w.totalInvested || 0) - delta.totalInvest),
          totalEarnings: Math.max(0, (w.totalEarnings || 0) - delta.totalEarnings)
        }, adminToken));
        walletRevertedCount++;
      }
    }
    for (let i = 0; i < walletPromises.length; i += 20) {
      await Promise.all(walletPromises.slice(i, i + 20));
    }

    let deletedBonuses = 0;
    const deletePromises = [];
    for (const b of todayBonuses) {
      deletePromises.push(fetch(\`\${FIRESTORE_BASE}/bonuses/\${b.id}\`, {
        method: 'DELETE',
        headers: { 'Authorization': \`Bearer \${adminToken}\` }
      }));
      deletedBonuses++;
    }
    for (let i = 0; i < deletePromises.length; i += 20) {
      await Promise.all(deletePromises.slice(i, i + 20));
    }

    const lock = await fsGet(\`settlements/2026-03-20\`, adminToken);
    if (lock) {
      await fetch(\`\${FIRESTORE_BASE}/settlements/2026-03-20\`, {
        method: 'DELETE',
        headers: { 'Authorization': \`Bearer \${adminToken}\` }
      });
    }

    return c.json({ 
      success: true, 
      invRevertedCount, 
      walletRevertedCount, 
      deletedBonuses 
    });
  } catch(e) {
    return c.json({ error: e.message }, 500);
  }
});
`;

if (!code.includes('/api/admin/rollback-settlement')) {
  code = code.replace("app.get('/admin'", rollbackEndpoint + "\napp.get('/admin'");
  fs.writeFileSync('src/index.tsx', code);
  console.log("Added rollback endpoint.");
}
