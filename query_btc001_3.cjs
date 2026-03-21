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
  
  // Find all users with pagination
  let uid = null;
  let qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/users?pageSize=300";
  let nextPageToken = '';
  
  do {
      let pageUrl = qUrl + (nextPageToken ? `&pageToken=${nextPageToken}` : '');
      let uRes = await fetch(pageUrl, { headers });
      let uData = await uRes.json();
      let userDocs = uData.documents || [];
      
      for (const doc of userDocs) {
          const email = doc.fields.email?.stringValue || '';
          const username = doc.fields.username?.stringValue || '';
          const name = doc.fields.name?.stringValue || '';
          const ref = doc.fields.referralCode?.stringValue || '';
          if (email.includes('btc001') || username.includes('btc001') || name.includes('btc001') || ref.includes('btc001')) {
              uid = doc.name.split('/').pop();
              console.log("Found btc001 uid:", uid, "email:", email, "username:", username, "name:", name, "ref:", ref);
              break;
          }
      }
      if (uid) break;
      nextPageToken = uData.nextPageToken;
  } while (nextPageToken);

  if (!uid) {
      console.log("Could not find uid for btc001");
      
      // Let's just find any bonus with amountUsdt == 420.46
      console.log("Looking for 420.46 amount in bonuses...");
      let runQueryUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";
      let bRes = await fetch(runQueryUrl, {
        method: 'POST', headers,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'bonuses' }],
            where: { 
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'rank_matching' } } }
                    ]
                }
            }
          }
        })
      });
      let bData = await bRes.json();
      let bonuses = bData.filter(d => d.document).map(d => {
         let f = d.document.fields;
         return { 
             userId: f.userId?.stringValue,
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
      let targetBonuses = bonuses.filter(b => (b.amountUsdt == 420.46 || b.amountUsdt == '420.46' || Math.abs(parseFloat(b.amountUsdt) - 420.46) < 0.1) && b.date && b.date.includes("2026-03-20"));
      console.log("rank_matching bonuses near 420.46 on 20th:");
      console.dir(targetBonuses, { depth: null });
      
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
