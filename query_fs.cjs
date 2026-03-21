const fs = require('fs');

async function run() {
  const code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
  
  const saMatch = code.match(/const\s+SERVICE_ACCOUNT\s*=\s*(\{[\s\S]+?\n\})/);
  if (!saMatch) { console.error("No SA found"); return; }
  
  let saString = saMatch[1];
  const sa = new Function('return (' + saString + ');')();
  
  const crypto = require('crypto');
  function createJwt() {
    const header = { alg: 'RS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat, exp,
      scope: 'https://www.googleapis.com/auth/datastore'
    };
    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(b64Header + '.' + b64Payload);
    const signature = sign.sign(sa.private_key, 'base64url');
    return b64Header + '.' + b64Payload + '.' + signature;
  }
  
  const jwt = createJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const tData = await res.json();
  const token = tData.access_token;
  if (!token) { console.error("No token", tData); return; }
  
  const url = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";
  const qRes = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }]
      }
    })
  });
  const data = await qRes.json();
  let found = [];
  for (let d of data) {
    if (d.document) {
      let f = d.document.fields;
      let email = f.email ? f.email.stringValue : '';
      let name = f.name ? f.name.stringValue : '';
      let loginId = f.loginId ? f.loginId.stringValue : '';
      let id = d.document.name.split('/').pop();
      found.push({ id, email, name, loginId });
    }
  }
  fs.writeFileSync('users_list.json', JSON.stringify(found, null, 2));
  console.log("Dumped " + found.length + " users.");
}
run().catch(console.error);
