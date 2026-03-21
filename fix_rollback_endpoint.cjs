const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

code = code.replace("const bonuses = await fsQuery('bonuses', adminToken);", `
    let bonuses = [];
    let pageToken = null;
    do {
      const qUrl = \`\${FIRESTORE_BASE}/bonuses?pageSize=1000\${pageToken ? '&pageToken='+pageToken : ''}\`;
      const res = await fetch(qUrl, { headers: { 'Authorization': \`Bearer \${adminToken}\` } });
      const data = await res.json();
      if (data.documents) {
        bonuses = bonuses.concat(data.documents.map(d => {
          const doc = d;
          const id = doc.name.split('/').pop();
          const result = { id };
          for (const [k, v] of Object.entries(doc.fields || {})) {
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
`);

code = code.replace("const users = await fsQuery('users', adminToken);", `
    let users = [];
    let uPageToken = null;
    do {
      const qUrl = \`\${FIRESTORE_BASE}/users?pageSize=1000\${uPageToken ? '&pageToken='+uPageToken : ''}\`;
      const res = await fetch(qUrl, { headers: { 'Authorization': \`Bearer \${adminToken}\` } });
      const data = await res.json();
      if (data.documents) {
        users = users.concat(data.documents.map(d => {
          const doc = d;
          const id = doc.name.split('/').pop();
          const result = { id };
          for (const [k, v] of Object.entries(doc.fields || {})) {
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
      uPageToken = data.nextPageToken;
    } while (uPageToken);
`);

code = code.replace("const wallets = await fsQuery('wallets', adminToken);", `
    let wallets = [];
    let wPageToken = null;
    do {
      const qUrl = \`\${FIRESTORE_BASE}/wallets?pageSize=1000\${wPageToken ? '&pageToken='+wPageToken : ''}\`;
      const res = await fetch(qUrl, { headers: { 'Authorization': \`Bearer \${adminToken}\` } });
      const data = await res.json();
      if (data.documents) {
        wallets = wallets.concat(data.documents.map(d => {
          const doc = d;
          const id = doc.name.split('/').pop();
          const result = { id };
          for (const [k, v] of Object.entries(doc.fields || {})) {
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
`);

fs.writeFileSync('src/index.tsx', code);
console.log("Patched rollback endpoint for pagination.");
