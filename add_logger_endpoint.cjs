const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const endpoint = `
app.post('/api/admin/log-error', async (c) => {
  const data = await c.req.json();
  console.log("=== FRONTEND ERROR ===", data);
  return c.json({ success: true });
});
`;

if (!code.includes('/api/admin/log-error')) {
  code = code.replace("app.get('/admin'", endpoint + "\napp.get('/admin'");
  fs.writeFileSync('src/index.tsx', code);
  console.log("Added endpoint.");
}
