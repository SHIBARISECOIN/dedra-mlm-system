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
    
    let qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";
    
    // Check bonuses for today
    let bRes = await fetch(qUrl, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'bonuses' }],
          where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
        }
      })
    });
    let bData = await bRes.json();
    if (!Array.isArray(bData)) { console.log(bData); continue; }
    let bonuses = bData.filter(d => d.document).map(d => {
       let f = d.document.fields;
       return { 
           type: f.type?.stringValue, 
           amount: f.amount?.doubleValue || f.amount?.integerValue || 0, 
           amountUsdt: f.amountUsdt?.doubleValue || f.amountUsdt?.integerValue || 0,
           date: f.createdAt?.timestampValue || f.createdAt?.stringValue 
       };
    });
    let todayB = bonuses.filter(b => b.date && b.date.startsWith("2026-03-20"));
    console.log("Bonuses today (20th):", todayB.length, todayB);
  }
}
run().catch(console.error);
