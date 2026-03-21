const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const endpoint = `
app.get('/api/admin/do-reconstruct-wallet', async (c) => {
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

  let allWallets = [];
  let wPageToken = null;
  do {
    const res = await fetch(\`\${FIRESTORE_BASE}/wallets?pageSize=1000\${wPageToken ? '&pageToken='+wPageToken : ''}\`, { headers: { 'Authorization': \`Bearer \${adminToken}\` } });
    const data = await res.json();
    if (data.documents) {
      allWallets = allWallets.concat(data.documents.map(d => {
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
    wPageToken = data.nextPageToken;
  } while (wPageToken);

  const walletMap = new Map(allWallets.map(w => [w.id, w]));
  const zeroInvs = allInvs.filter(i => (i.amount === 0 || !i.amount) && i.status === 'active');
  
  let fixedCount = 0;
  const promises = [];
  const fixes = [];
  
  // Group zeroInvs by userId
  const userZeroInvs = {};
  for (const inv of zeroInvs) {
    if (!userZeroInvs[inv.userId]) userZeroInvs[inv.userId] = [];
    userZeroInvs[inv.userId].push(inv);
  }
  
  for (const [userId, invs] of Object.entries(userZeroInvs)) {
    const w = walletMap.get(userId);
    if (!w) continue;
    
    // We need to know if they have other NON-ZERO active investments
    const otherInvs = allInvs.filter(i => i.userId === userId && i.status === 'active' && i.amount > 0);
    const otherSum = otherInvs.reduce((s, i) => s + (i.amount || 0), 0);
    
    let remainingAmount = Math.max(0, (w.totalInvest || w.totalInvested || 0) - otherSum);
    
    if (remainingAmount > 0) {
      // Split remainingAmount equally among the zero investments
      const amountPerInv = remainingAmount / invs.length;
      
      for (const inv of invs) {
        const roiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        const expectedReturn = amountPerInv * (roiPct / 100);
        
        promises.push(fsPatch(\`investments/\${inv.id}\`, {
          amount: amountPerInv,
          amountUsdt: amountPerInv,
          expectedReturn: expectedReturn
        }, adminToken));
        
        fixes.push({ id: inv.id, userId, old: 0, new: amountPerInv });
        fixedCount++;
      }
    }
  }
  
  for (let i = 0; i < promises.length; i += 20) {
    await Promise.all(promises.slice(i, i + 20));
  }
  
  return c.json({ success: true, fixedCount, fixes: fixes.slice(0, 10), totalZeroUsers: Object.keys(userZeroInvs).length });
});
`;

if (!code.includes('/api/admin/do-reconstruct-wallet')) {
  code = code.replace("app.get('/admin'", endpoint + "\napp.get('/admin'");
  fs.writeFileSync('src/index.tsx', code);
}
