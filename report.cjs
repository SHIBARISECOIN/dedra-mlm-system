const fs = require('fs');

async function checkIndex() {
  const indexStr = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf-8');
  if (!indexStr.includes('/api/admin/temp-report')) {
    const patch = `
app.get('/api/admin/temp-report', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const invs = await fsQuery('investments', adminToken, [], 5000);
    const bonuses = await fsQuery('bonuses', adminToken, [], 10000);
    
    // Filter bonuses for today (type: roi)
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBonuses = bonuses.filter((b: any) => 
      b.type === 'roi' && 
      b.createdAt && 
      String(b.createdAt).startsWith(todayStr)
    );

    const userMap: any = {};
    for (const b of todayBonuses) {
      if (!userMap[b.userId]) userMap[b.userId] = { totalRoiUsdt: 0, days: [] };
      userMap[b.userId].totalRoiUsdt += (b.amountUsdt || 0);
      
      const reasonMatch = (b.reason || '').match(/(\\d+)일치/);
      if (reasonMatch) userMap[b.userId].days.push(parseInt(reasonMatch[1]));
    }

    const activeInvs = invs.filter((i: any) => i.status === 'active');
    for (const inv of activeInvs) {
      if (!userMap[inv.userId]) continue;
      userMap[inv.userId].principal = (userMap[inv.userId].principal || 0) + (inv.amountUsdt || inv.amount || 0);
    }

    const results = Object.keys(userMap).map(uid => {
      const d = userMap[uid];
      const principal = d.principal || 0;
      const ratio = principal > 0 ? (d.totalRoiUsdt / principal) * 100 : 0;
      return {
        userId: uid,
        principal: principal,
        payout: d.totalRoiUsdt,
        ratio: ratio.toFixed(2) + '%',
        daysApplied: d.days.join(',')
      };
    }).sort((a, b) => b.payout - a.payout);

    return c.json({ success: true, results, totalPaidToday: todayBonuses.reduce((s:number, b:any)=>s+(b.amountUsdt||0),0) });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
`;
    fs.writeFileSync('/home/user/webapp/src/index.tsx', indexStr.replace(`app.post('/api/admin/run-settlement', async (c) => {`, patch + `\napp.post('/api/admin/run-settlement', async (c) => {`));
    console.log("Patched route. Please build and we can fetch the report.");
  } else {
    console.log("Already patched.");
  }
}
checkIndex();
