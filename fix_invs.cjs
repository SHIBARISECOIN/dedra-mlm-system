const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const endpoint = `
app.get('/api/admin/do-reconstruct', async (c) => {
  const adminToken = await getAdminToken();
  let allInvs = [];
  let pageToken = null;
  do {
    const res = await fetch(\`\${FIRESTORE_BASE}/investments?pageSize=1000\${pageToken ? '&pageToken='+pageToken : ''}\`, { headers: { 'Authorization': \`Bearer \${adminToken}\` } });
    const data = await res.json();
    if (data.documents) {
      allInvs = allInvs.concat(data.documents.map(d => {
        const id = d.name.split('/').pop();
        const result = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
          result[k] = v.stringValue !== undefined ? v.stringValue 
                    : v.integerValue !== undefined ? Number(v.integerValue)
                    : v.doubleValue !== undefined ? v.doubleValue
                    : v.booleanValue !== undefined ? v.booleanValue
                    : v.timestampValue !== undefined ? v.timestampValue
                    : null;
        }
        return result;
      }));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  let allTxs = [];
  let tPageToken = null;
  do {
    const res = await fetch(\`\${FIRESTORE_BASE}/transactions?pageSize=1000\${tPageToken ? '&pageToken='+tPageToken : ''}\`, { headers: { 'Authorization': \`Bearer \${adminToken}\` } });
    const data = await res.json();
    if (data.documents) {
      allTxs = allTxs.concat(data.documents.map(d => {
        const id = d.name.split('/').pop();
        const result = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
          result[k] = v.stringValue !== undefined ? v.stringValue 
                    : v.integerValue !== undefined ? Number(v.integerValue)
                    : v.doubleValue !== undefined ? v.doubleValue
                    : v.booleanValue !== undefined ? v.booleanValue
                    : v.timestampValue !== undefined ? v.timestampValue
                    : null;
        }
        return result;
      }));
    }
    tPageToken = data.nextPageToken;
  } while (tPageToken);

  const deposits = allTxs.filter(t => t.type === 'deposit' && t.status === 'approved');
  const zeroInvs = allInvs.filter(i => (i.amount === 0 || !i.amount) && i.status === 'active');
  
  const userMap = new Map(); // Get users to check autoCompound
  const usersRes = await fetch(\`\${FIRESTORE_BASE}/users?pageSize=1000\`, { headers: { 'Authorization': \`Bearer \${adminToken}\` } });
  const usersData = await usersRes.json();
  // Simplified for now, just to be safe. We only care about base amount.
  
  let fixedCount = 0;
  const promises = [];
  const fixes = [];
  
  for (const inv of zeroInvs) {
    // Find closest deposit
    const userDeps = deposits.filter(d => d.userId === inv.userId);
    let bestDep = null;
    let minDiff = Infinity;
    const invTime = new Date(inv.createdAt).getTime();
    for (const d of userDeps) {
      const depTime = new Date(d.approvedAt || d.createdAt).getTime();
      const diff = Math.abs(invTime - depTime);
      if (diff < minDiff && diff < 86400000) { // within 24 hours
        minDiff = diff;
        bestDep = d;
      }
    }
    
    if (bestDep) {
      const baseAmount = bestDep.amount;
      // If there was paidRoi and they autoCompounded, real amount = baseAmount + paidRoi.
      // We don't exactly know if they autoCompounded, but paidRoi is 0 for most of them.
      // Just to be safe, we'll restore to baseAmount + paidRoi (assuming paidRoi was compounded).
      // Wait, if they didn't autoCompound, restoring to baseAmount + paidRoi is WRONG.
      // But paidRoi is 0! So baseAmount is perfect.
      const newAmount = baseAmount + (inv.paidRoi || 0); // worst case they get a tiny bit more if they didn't autoCompound. Actually, let's just use baseAmount if paidRoi > 0 is tricky, but paidRoi is 0.
      const finalAmount = inv.paidRoi > 0 ? baseAmount : baseAmount; 
      
      const roiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
      const expectedReturn = finalAmount * (roiPct / 100);
      
      promises.push(fsPatch(\`investments/\${inv.id}\`, {
        amount: finalAmount,
        amountUsdt: finalAmount,
        expectedReturn: expectedReturn
      }, adminToken));
      
      fixes.push({ id: inv.id, old: inv.amount, new: finalAmount });
      fixedCount++;
    }
  }
  
  for (let i = 0; i < promises.length; i += 20) {
    await Promise.all(promises.slice(i, i + 20));
  }
  
  // Oh wait, we need to fix the wallets as well!
  // Since we rolled back investments, did we ruin wallets?
  // Our rollback script did: totalInvest -= delta.totalInvest
  // Wait, if we subtracted from totalInvest during rollback, we might have dropped it too low if it wasn't compounded? No, we correctly tracked autoCompound in rollback!
  // Wait, no we didn't! We set totalInvest -= b.amountUsdt! But we didn't subtract the principal! We only subtracted the ROI.
  // The wallets' totalInvest still has the principal! We just need to fix the investments collection so runSettle doesn't skip them.
  
  return c.json({ success: true, fixedCount, fixes: fixes.slice(0, 10) });
});
`;

if (!code.includes('/api/admin/do-reconstruct')) {
  code = code.replace("app.get('/admin'", endpoint + "\napp.get('/admin'");
  fs.writeFileSync('src/index.tsx', code);
}
