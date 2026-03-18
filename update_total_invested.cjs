const fs = require('fs');
const crypto = require('crypto');

const indexCode = fs.readFileSync('./src/index.tsx', 'utf8');
const saMatch = indexCode.match(/const SERVICE_ACCOUNT = ({[\s\S]*?\n})/);
let saCode = saMatch[1];
const sa = eval('(' + saCode + ')');

async function getAdminToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${encHeader}.${encPayload}`;
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(sa.private_key).toString('base64url');
  
  const jwt = `${unsigned}.${signature}`;
  
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  return data.access_token;
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

async function run() {
  try {
    const token = await getAdminToken();
    console.log("Token obtained");
    
    // Get all investments
    const resInvs = await fetch(`${FIRESTORE_BASE}/investments?pageSize=1000`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const invsData = await resInvs.json();
    
    // Calculate total invest per user
    const userTotals = {};
    for (const doc of (invsData.documents || [])) {
        const fields = doc.fields || {};
        if (fields.status && fields.status.stringValue === 'active') {
            if (!fields.userId || !fields.userId.stringValue) continue;
            const uid = fields.userId.stringValue;
            let amount = 0;
            if (fields.amount) {
                amount = Number(fields.amount.integerValue || fields.amount.doubleValue || fields.amount.stringValue || 0);
            }
            userTotals[uid] = (userTotals[uid] || 0) + amount;
        }
    }
    
    console.log(`Found investments for ${Object.keys(userTotals).length} users`);
    
    // Update wallet.totalInvested
    for (const [uid, total] of Object.entries(userTotals)) {
        // We do a PATCH on wallets/{uid} using updateMask
        const patchRes = await fetch(`${FIRESTORE_BASE}/wallets/${uid}?updateMask.fieldPaths=totalInvested`, {
            method: 'PATCH',
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    totalInvested: { doubleValue: total }
                }
            })
        });
        if (!patchRes.ok) {
             console.error(`Failed to update wallet for ${uid}: ${await patchRes.text()}`);
        }
    }
    console.log('Update complete');
  } catch(e) {
    console.error(e);
  }
}
run();
