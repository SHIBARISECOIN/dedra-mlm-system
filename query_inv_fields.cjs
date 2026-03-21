const fs = require('fs');
async function run() {
  const code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
  const saMatch = code.match(/const\s+SERVICE_ACCOUNT\s*=\s*(\{[\s\S]+?\n\})/);
  const sa = new Function('return (' + saMatch[1] + ');')();
  const crypto = require('crypto');
  function createJwt() {
    const h = { alg: 'RS256', typ: 'JWT' };
    const i = Math.floor(Date.now() / 1000);
    const p = { iss: sa.client_email, sub: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: i, exp: i + 3600, scope: 'https://www.googleapis.com/auth/datastore' };
    const b64H = Buffer.from(JSON.stringify(h)).toString('base64url');
    const b64P = Buffer.from(JSON.stringify(p)).toString('base64url');
    const s = crypto.createSign('RSA-SHA256');
    s.update(b64H + '.' + b64P);
    return b64H + '.' + b64P + '.' + s.sign(sa.private_key, 'base64url');
  }
  const tData = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + createJwt()
  })).json();
  const headers = { 'Authorization': 'Bearer ' + tData.access_token };
  
  let qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";
  let iRes = await fetch(qUrl, {
    method: 'POST', headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'investments' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: 'Dtofn4aFQlevbVPfGOS4atv0lWv2' } } }
      }
    })
  });
  let iData = await iRes.json();
  console.log(JSON.stringify(iData, null, 2));
}
run().catch(console.error);
