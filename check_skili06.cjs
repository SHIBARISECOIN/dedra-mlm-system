const fs = require('fs');

async function check() {
  const code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
  let match = code.match(/app\.post\('\/api\/admin\/run-settlement'/);
  
  if(match) {
    const inject = `
app.get('/api/admin/check-user/:username', async (c) => {
  try {
    const username = c.req.param('username');
    const token = await getAdminToken();
    const headers = { 'Authorization': \`Bearer \${token}\` };
    
    // search user
    const usersReq = await fetch(\`\${FIRESTORE_BASE}/projects/\${PROJECT_ID}/databases/(default)/documents:runQuery\`, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }]
        }
      })
    });
    const usersData = await usersReq.json();
    let userDoc = null;
    let uid = null;
    
    for (const d of usersData) {
      if (d.document) {
        const fields = d.document.fields;
        if ((fields.email && fields.email.stringValue && fields.email.stringValue.includes(username)) || 
            (fields.loginId && fields.loginId.stringValue && fields.loginId.stringValue.includes(username)) ||
            (fields.name && fields.name.stringValue && fields.name.stringValue.includes(username))) {
          userDoc = d.document;
          uid = d.document.name.split('/').pop();
          break;
        }
      }
    }
    
    if (!uid) return c.json({ error: 'User not found' });
    
    // Get wallet
    const walletReq = await fetch(\`\${FIRESTORE_BASE}/projects/\${PROJECT_ID}/databases/(default)/documents/wallets/\${uid}\`, { headers });
    const walletData = await walletReq.json();
    
    // Get active investments
    const invReq = await fetch(\`\${FIRESTORE_BASE}/projects/\${PROJECT_ID}/databases/(default)/documents:runQuery\`, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'investments' }],
          where: {
            fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } }
          }
        }
      })
    });
    const invData = await invReq.json();
    
    // Get bonus logs for today
    const bonusReq = await fetch(\`\${FIRESTORE_BASE}/projects/\${PROJECT_ID}/databases/(default)/documents:runQuery\`, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'bonusLogs' }],
          where: {
            fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } }
          }
        }
      })
    });
    const bonusData = await bonusReq.json();
    
    return c.json({ uid, userDoc, wallet: walletData, investments: invData, bonuses: bonusData.map(b => b.document) });
  } catch (e) {
    return c.json({ error: e.message });
  }
});
`;
    fs.writeFileSync('/home/user/webapp/src/index.tsx', code.replace("app.post('/api/admin/run-settlement'", inject + "\napp.post('/api/admin/run-settlement'"));
    console.log('Injected');
  }
}
check();
