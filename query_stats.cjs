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
    
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date();
    // In node, new Date() is local time. Assuming UTC environment.
    const utcNow = now.getTime();
    const kstNow = new Date(utcNow + kstOffset);
    
    // Original logic:
    // startKst = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 0, 0, 0);
    // endKst = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 23, 59, 59, 999);
    // Oh wait, in browser, `new Date(yyyy, mm, dd)` creates a date using the *browser's local timezone*.
    // If the admin is in Korea (UTC+9), new Date(...) works correctly.
    // If the admin is NOT in Korea, new Date(kstYear, kstMonth, kstDate) creates a local time representing those numbers.
    // Let's simulate browser local time behavior.
    
    console.log("=== Checking Admin's Daily Stats Logic ===");
    console.log("Current KST:", kstNow.toISOString());

    // Fetch all approved deposits
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
    
    console.log("\nRecent 10 Approved Deposits:");
    for(let i=0; i<Math.min(10, docs.length); i++) {
       if(!docs[i].document) continue;
       const fields = docs[i].document.fields;
       const amt = fields.amount?.doubleValue || fields.amount?.integerValue || 0;
       const timeStr = fields.createdAt?.timestampValue;
       
       let kstStr = "N/A";
       if(timeStr) {
          const t = new Date(timeStr);
          kstStr = new Date(t.getTime() + kstOffset).toISOString();
       }
       console.log(`- ${kstStr} : $${amt} (user: ${fields.userId?.stringValue})`);
    }

  } catch(e) {
    console.error(e);
  }
}
run();
