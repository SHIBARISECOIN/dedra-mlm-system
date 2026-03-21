const fs = require('fs');
async function run() {
  const code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
  const saMatch = code.match(/const\s+SERVICE_ACCOUNT\s*=\s*(\{[\s\S]+?\n\})/);
  const sa = new Function('return (' + saMatch[1] + ');')();
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
  
  const token = (await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + createJwt()
  })).json()).access_token;
  const headers = { 'Authorization': 'Bearer ' + token };
  
  let qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";
  let iRes = await fetch(qUrl, {
    method: 'POST', headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'investments' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } }
      }
    })
  });
  let iData = await iRes.json();
  let invSum = 0;
  let userSums = {};
  iData.forEach(d => {
      if(d.document) {
          let u = d.document.fields.userId?.stringValue;
          let amt = d.document.fields.amount?.numberValue || d.document.fields.amount?.integerValue || 0;
          if(u) {
              userSums[u] = (userSums[u] || 0) + Number(amt);
              invSum += Number(amt);
          }
      }
  });
  console.log("Total active investments:", invSum);
  console.log("User counts:", Object.keys(userSums).length);
  
  // also get wallets
  let wRes = await fetch("https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/wallets?pageSize=1000", { headers });
  let wData = await wRes.json();
  let wSum = 0;
  (wData.documents || []).forEach(w => {
      let t = w.fields.totalInvest?.numberValue || w.fields.totalInvest?.integerValue || 0;
      wSum += Number(t);
  });
  console.log("Total wallets totalInvest:", wSum);
}
run().catch(console.error);
