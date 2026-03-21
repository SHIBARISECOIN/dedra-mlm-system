const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
let match = code.match(/app\.get\('\/api\/admin\/check-user\/:username'/);
if (match) {
  const inject = `
app.get('/api/admin/find-user/:q', async (c) => {
  try {
    const q = c.req.param('q').toLowerCase();
    const token = await getAdminToken();
    const headers = { 'Authorization': \`Bearer \${token}\` };
    const req = await fetch(\`\${FIRESTORE_BASE}/projects/\${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery\`, {
      method: 'POST', headers,
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'users' }] } })
    });
    const data = await req.json();
    const results = [];
    for (const d of data) {
      if (d.document) {
        const str = JSON.stringify(d.document).toLowerCase();
        if (str.includes(q)) {
          results.push(d.document);
        }
      }
    }
    return c.json(results);
  } catch (e) { return c.json({ error: e.message }); }
});
`;
  fs.writeFileSync('/home/user/webapp/src/index.tsx', code.replace("app.get('/api/admin/check-user/:username'", inject + "\napp.get('/api/admin/check-user/:username'"));
}
