const crypto = require('crypto');
const fs = require('fs');

const saContent = fs.readFileSync('/home/user/webapp/sa.js', 'utf8')
  .replace('const SERVICE_ACCOUNT = ', '')
  .replace(/};\s*$/, '}');

const SERVICE_ACCOUNT = eval('(' + saContent + ')');

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit'
  };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sigInput = `${b64url(header)}.${b64url(payload)}`;
  
  const pemKey = SERVICE_ACCOUNT.private_key;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(sigInput);
  sign.end();
  const signature = sign.sign(pemKey, 'base64url');
  
  const jwt = `${sigInput}.${signature}`;
  
  const res = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  return data.access_token;
}

async function run() {
  const token = await getToken();
  const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
  
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'investments' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: 'rlSK0MotrUT1AbEXlSAmolfKpZ42' } } }
          ]
        }
      },
      limit: 100
    }
  };
  
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await res.json();
  console.log("Investments for tiffany01:");
  data.forEach(item => {
    if (item.document) {
      const d = item.document;
      const f = d.fields;
      console.log(`ID: ${d.name.split('/').pop()}, amount: ${f.amount?.integerValue || f.amount?.doubleValue}, created: ${f.createdAt?.timestampValue}`);
    }
  });
}
run().catch(console.error);
