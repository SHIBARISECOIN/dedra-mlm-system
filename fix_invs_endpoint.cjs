const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const endpoint = `
app.get('/api/admin/check-reconstruct', async (c) => {
  const adminToken = await getAdminToken();
  const invs = await fsQuery('investments', adminToken, [], 1000);
  const txs = await fsQuery('transactions', adminToken, [], 1000);
  
  const deposits = txs.filter((t: any) => t.type === 'deposit' && t.status === 'approved');
  const zeroInvs = invs.filter((i: any) => (i.amount === 0 || !i.amount) && i.status === 'active');
  
  return c.json({ zeroInvs: zeroInvs.slice(0, 5), deposits: deposits.slice(0, 5) });
});
`;

if (!code.includes('/api/admin/check-reconstruct')) {
  code = code.replace("app.get('/admin'", endpoint + "\napp.get('/admin'");
  fs.writeFileSync('src/index.tsx', code);
}
