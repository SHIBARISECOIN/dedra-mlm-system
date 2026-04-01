const fs = require('fs');
const path = '/home/user/webapp/src/index.tsx';
let code = fs.readFileSync(path, 'utf8');

const debugRoute = `
app.get('/api/debug/settlement-check-today', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const lockDoc = await fsGet(\`settlements/\${today}\`, adminToken);
    
    // Get last few settlements just in case
    const recent = await fsQuery('settlements', adminToken, [], 5);
    
    return c.json({
      success: true,
      today: today,
      settlement_data: lockDoc?.fields ? firestoreDocToObj(lockDoc) : null,
      recent: recent
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/debug/settlement-run-now', async (c) => {
  return runSettle(c, null);
});
`;

code = code.replace("export default {", debugRoute + "\nexport default {");
fs.writeFileSync(path, code);
