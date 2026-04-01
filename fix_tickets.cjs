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
    
    // Count real tickets
    const wQuery = {
      structuredQuery: {
        from: [{ collectionId: 'wallets' }],
        limit: 10000
      }
    };
    const wRes = await fetch(`${baseUrl}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(wQuery) });
    const wallets = await wRes.json();
    
    let totalComputedTickets = 0;
    
    for (const w of wallets) {
       if(!w.document) continue;
       const fields = w.document.fields;
       const tix = fields.weeklyTickets?.doubleValue || fields.weeklyTickets?.integerValue || 0;
       if (tix > 0) {
          totalComputedTickets += Number(tix);
       }
    }
    
    console.log(`Re-computed Total Tickets: ${totalComputedTickets}`);
    
    // Update the events/weekly_jackpot doc
    const patchBody = {
       fields: {
          totalTickets: { integerValue: totalComputedTickets }
       }
    };
    const patchRes = await fetch(`${baseUrl}/events/weekly_jackpot?updateMask.fieldPaths=totalTickets`, {
       method: 'PATCH',
       headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
       body: JSON.stringify(patchBody)
    });
    const patchOut = await patchRes.json();
    console.log("Patch output:", patchOut.name ? "Success" : patchOut);

  } catch(e) {
    console.error(e);
  }
}
run();
