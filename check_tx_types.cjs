const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');

const endp = `
app.get('/api/admin/dump-tx-types', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const txs = await fsQuery('transactions', adminToken, [], 100000);
    const types = {};
    txs.forEach(t => {
      types[t.type] = (types[t.type] || 0) + 1;
    });
    return c.json({success: true, types});
  } catch (e) {
    return c.json({success: false, error: e.message});
  }
});
`;

if (!code.includes('/api/admin/dump-tx-types')) {
  code = code.replace("app.get('/api/admin/sync-sales'", endp + "\napp.get('/api/admin/sync-sales'");
  fs.writeFileSync('/home/user/webapp/src/index.tsx', code);
}
