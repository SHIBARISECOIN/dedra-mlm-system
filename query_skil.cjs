const fs = require('fs');

async function run() {
  const code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
  const saMatch = code.match(/const\s+SERVICE_ACCOUNT\s*=\s*(\{[\s\S]+?\n\})/);
  let saString = saMatch[1];
  const sa = new Function('return (' + saString + ');')();
  
  const crypto = require('crypto');
  function createJwt() {
    const header = { alg: 'RS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = {
      iss: sa.client_email, sub: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat, exp, scope: 'https://www.googleapis.com/auth/datastore'
    };
    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(b64Header + '.' + b64Payload);
    return b64Header + '.' + b64Payload + '.' + sign.sign(sa.private_key, 'base64url');
  }
  
  const jwt = createJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const tData = await res.json();
  const token = tData.access_token;
  
  const headers = { 'Authorization': 'Bearer ' + token };
  
  for (let uid of ["BaSIss1bHBUrj35G54yh7yimsUh2", "Dtofn4aFQlevbVPfGOS4atv0lWv2"]) {
    console.log("---- USER:", uid, "----");
    
    // Check wallet
    let wUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/wallets/" + uid;
    let wRes = await fetch(wUrl, { headers });
    let wData = await wRes.json();
    console.log("Wallet:");
    if (wData.fields) {
       console.log("  totalInvest:", wData.fields.totalInvest?.numberValue || wData.fields.totalInvest?.integerValue);
       console.log("  bonusBalance:", wData.fields.bonusBalance?.numberValue || wData.fields.bonusBalance?.integerValue);
    } else {
       console.log("  ", wData.error);
    }
    
    // Check investments
    let qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";
    let iRes = await fetch(qUrl, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'investments' }],
          where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
        }
      })
    });
    let iData = await iRes.json();
    let invs = iData.filter(d => d.document).map(d => {
       let f = d.document.fields;
       return { id: d.document.name.split('/').pop(), status: f.status?.stringValue, amount: f.amount?.numberValue || f.amount?.integerValue || 0, lastSettledAt: f.lastSettledAt?.timestampValue };
    });
    console.log("Investments:", invs);
    
    // Check bonus logs for today
    let bRes = await fetch(qUrl, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'bonusLogs' }],
          where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
        }
      })
    });
    let bData = await bRes.json();
    let bonuses = bData.filter(d => d.document).map(d => {
       let f = d.document.fields;
       return { type: f.type?.stringValue, amount: f.amount?.numberValue, date: f.createdAt?.timestampValue };
    });
    let todayB = bonuses.filter(b => b.date && b.date.startsWith("2026-03-20"));
    console.log("Bonuses today (20th):", todayB.length, todayB);
  }
}
run().catch(console.error);
