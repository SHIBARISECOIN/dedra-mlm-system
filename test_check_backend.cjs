const fs = require('fs');
const path = '/home/user/webapp/src/index.tsx';
let code = fs.readFileSync(path, 'utf8');

const debugRoute = `
app.get('/api/debug/settlement-check-today', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const lockDoc = await fsGet(\`settlements/\${today}\`, adminToken);
    return c.json({
      success: true,
      today: today,
      settlement_data: lockDoc?.fields ? firestoreDocToObj(lockDoc) : null
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
`;

if (!code.includes('/api/debug/settlement-check-today')) {
  code = code.replace(/export default app/, debugRoute + '\nexport default app');
  fs.writeFileSync(path, code);
  console.log("Debug route added");
}
