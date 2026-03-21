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
  
  // Find all users and filter by btc001 in email or username
  let qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/users?pageSize=1000";
  let uRes = await fetch(qUrl, { headers });
  let uData = await uRes.json();
  let uid = null;
  let userDocs = uData.documents || [];
  
  for (const doc of userDocs) {
      const email = doc.fields.email?.stringValue || '';
      const username = doc.fields.username?.stringValue || '';
      if (email.includes('btc001') || username.includes('btc001')) {
          uid = doc.name.split('/').pop();
          console.log("Found btc001 uid:", uid, "email:", email, "username:", username);
          break;
      }
  }

  if (!uid) {
      console.log("Could not find uid for btc001");
      return;
  }

  // Find bonuses for this user on 2026-03-20
  let runQueryUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";
  let bRes = await fetch(runQueryUrl, {
    method: 'POST', headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
      }
    })
  });
  let bData = await bRes.json();
  let bonuses = bData.filter(d => d.document).map(d => {
     let f = d.document.fields;
     return { 
         type: f.type?.stringValue, 
         amount: f.amount?.numberValue || f.amount?.integerValue, 
         amountUsdt: f.amountUsdt?.numberValue || f.amountUsdt?.integerValue || f.amountUsdt?.stringValue,
         date: f.createdAt?.timestampValue || f.settlementDate?.stringValue,
         reason: f.reason?.stringValue,
         fromUserId: f.fromUserId?.stringValue,
         level: f.level?.integerValue,
         baseIncome: f.baseIncome?.numberValue || f.baseIncome?.integerValue
     };
  });
  
  let targetBonuses = bonuses.filter(b => b.type === 'rank_matching' && b.date && b.date.includes("2026-03-20"));
  console.log("rank_matching bonuses for btc001 on 20th:");
  console.dir(targetBonuses, { depth: null });
}
run().catch(console.error);
