const fs = require('fs');
const crypto = require('crypto');

const indexCode = fs.readFileSync('./src/index.tsx', 'utf8');
const saMatch = indexCode.match(/const SERVICE_ACCOUNT\s*=\s*({[\s\S]*?\n})/);
const sa = eval('(' + saMatch[1] + ')');

async function getAdminToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: sa.client_email, sub: sa.client_email, aud: sa.token_uri, iat: now, exp: now + 3600, scope: 'https://www.googleapis.com/auth/datastore' };
  const unsigned = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256'); sign.update(unsigned);
  const signature = sign.sign(sa.private_key).toString('base64url');
  
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${signature}` });
  const data = await res.json();
  return data.access_token;
}

async function run() {
  try {
    const token = await getAdminToken();
    const projectId = sa.project_id;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    
    // Simulate exactly what frontend is doing
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date();
    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000); // browser specific, but let's emulate what browser does
    // Wait, in browser `now.getTimezoneOffset()` returns local offset. If I'm in Korea, it's -540.
    // If browser is in Korea, `now` is already KST conceptually but `getTime()` is UTC ms.
    
    const browserNow = new Date(); // assume the browser is running this. The user is in Korea (UTC+9).
    const startKst = new Date(browserNow.getFullYear(), browserNow.getMonth(), browserNow.getDate(), 0, 0, 0);
    const endKst = new Date(browserNow.getFullYear(), browserNow.getMonth(), browserNow.getDate(), 23, 59, 59, 999);
    
    console.log("If User is in Korea:");
    console.log("Start:", startKst.toISOString());
    console.log("End:", endKst.toISOString());
    
    const qD = {
      structuredQuery: {
        from: [{ collectionId: 'transactions' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'deposit' } } },
              { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }
            ]
          }
        },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 100
      }
    };
    
    const dRes = await fetch(`${baseUrl}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(qD) });
    const docs = await dRes.json();
    
    console.log("\nAll recent deposits and their timestamps:");
    for(let i=0; i<20; i++) {
       if(!docs[i] || !docs[i].document) continue;
       const data = docs[i].document.fields;
       const amt = data.amount?.doubleValue || data.amount?.integerValue || 0;
       const ts = data.createdAt || data.completedAt || data.updatedAt;
       console.log(`Amt: ${amt}, TS:`, JSON.stringify(ts));
    }
  } catch(e) {
    console.error(e);
  }
}
run();
