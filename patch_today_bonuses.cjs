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
  const BASE_URL = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents";
  
  // Query all bonuses
  let qRes = await fetch(BASE_URL + ":runQuery", {
    method: 'POST', headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }]
        // We will filter in-memory since we might not be able to index query by createdAt string
      }
    })
  });
  let data = await qRes.json();
  console.log("Total bonuses fetched:", data.length);
  
  let writes = [];
  
  for (let d of data) {
    if (!d.document) continue;
    let fields = d.document.fields;
    
    let needsUpdate = false;
    let updateFields = {};
    
    // Check if createdAt is string
    if (fields.createdAt && fields.createdAt.stringValue) {
      if (fields.createdAt.stringValue.startsWith('2026-03-20')) {
         updateFields.createdAt = { timestampValue: fields.createdAt.stringValue };
         needsUpdate = true;
      }
    }
    
    // Check if settlementDate is missing
    if (!fields.settlementDate && fields.createdAt) {
      let dateStr = fields.createdAt.stringValue || fields.createdAt.timestampValue;
      if (dateStr && dateStr.startsWith('2026-03-20')) {
        updateFields.settlementDate = { stringValue: '2026-03-20' };
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
       // Keep existing fields
       let newFields = { ...fields, ...updateFields };
       writes.push({
         update: {
           name: d.document.name,
           fields: newFields
         }
       });
    }
  }
  
  console.log("Needs update:", writes.length);
  
  // Batch commit 400 at a time
  for (let i = 0; i < writes.length; i += 400) {
    let batch = writes.slice(i, i + 400);
    let commitRes = await fetch(BASE_URL + ":commit", {
      method: 'POST', headers,
      body: JSON.stringify({ writes: batch })
    });
    let commitData = await commitRes.json();
    if (commitData.error) {
      console.error("Batch error:", commitData.error);
    } else {
      console.log("Committed batch", i);
    }
  }
  console.log("Done");
}
run().catch(console.error);
