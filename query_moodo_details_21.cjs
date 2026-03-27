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
  
  const qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";

  let bRes = await fetch(qUrl, {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: 'KM7pKoYx4lM2gUt1wKPgT2rl57M2' } } } // moodo9569
      }
    })
  });
  
  let bData = await bRes.json();
  let bonuses = bData.filter(d => d.document).map(d => {
      let f = d.document.fields;
      let amt = f.amountUsdt?.numberValue ?? f.amountUsdt?.integerValue ?? parseFloat(f.amountUsdt?.stringValue || '0');
      return {
          type: f.type?.stringValue,
          amountUsdt: Number(amt),
          date: (f.createdAt?.timestampValue || f.settlementDate?.stringValue || '').substring(0, 10),
          reason: f.reason?.stringValue
      };
  });
  
  bonuses.filter(b => b.date === '2026-03-21').sort((a,b) => a.reason.localeCompare(b.reason)).forEach(b => {
      console.log(`[${b.date}] ${b.type}: ${b.amountUsdt} USDT | ${b.reason}`);
  });
}
run().catch(console.error);
