const fs = require('fs');

let code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');

if (!code.includes('/api/admin/sync-tree-sales')) {
  const syncCode = `
app.post('/api/admin/sync-tree-sales', async (c) => {
  try {
    const body = await c.req.json().catch(()=>({})) as any;
    if (body.secret !== 'deedra-cron-2026') return c.json({ error: 'Unauthorized' }, 401);
    
    const adminToken = await getAdminToken();
    const users = await fsQuery('users', adminToken, [], 100000);
    
    const usersMap: any = {};
    const childrenMap: any = {};
    
    users.forEach((u: any) => {
      usersMap[u.id] = {
        uid: u.id,
        invested: u.totalInvested || 0,
        referredBy: u.referredBy || null,
        networkSales: 0
      };
    });
    
    for (const uid in usersMap) {
      const pId = usersMap[uid].referredBy;
      if (pId && usersMap[pId]) {
        if (!childrenMap[pId]) childrenMap[pId] = [];
        childrenMap[pId].push(uid);
      }
    }
    
    const memo: any = {};
    function getSales(uid: string) {
      if (memo[uid] !== undefined) return memo[uid];
      let sum = 0;
      const children = childrenMap[uid] || [];
      for (const childId of children) {
        sum += usersMap[childId].invested + getSales(childId);
      }
      memo[uid] = sum;
      return sum;
    }
    
    let updatedCount = 0;
    const promises = [];
    
    for (const uid in usersMap) {
      const actualSales = getSales(uid);
      const currentSales = users.find((u: any) => u.id === uid)?.networkSales || 0;
      
      if (actualSales !== currentSales) {
        promises.push(fsPatch(\`users/\${uid}\`, { networkSales: actualSales }, adminToken));
        updatedCount++;
      }
    }
    
    // Process in batches
    for (let i = 0; i < promises.length; i += 50) {
      await Promise.all(promises.slice(i, i + 50));
    }
    
    return c.json({ success: true, updatedCount });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
`;
  
  // Insert before the last export default app
  code = code.replace("export default app", syncCode + "\nexport default app");
  fs.writeFileSync('/home/user/webapp/src/index.tsx', code);
  console.log("Patched index.tsx with sync-tree-sales endpoint");
}
