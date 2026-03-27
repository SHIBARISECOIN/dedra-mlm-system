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

  let uRes = await fetch(qUrl, {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        limit: 10000
      }
    })
  });
  let uData = await uRes.json();
  
  let usersList = uData.filter(d => d.document).map(d => {
      let uid = d.document.name.split('/').pop();
      let f = d.document.fields;
      return {
          uid,
          id: f.id?.stringValue || '',
          email: f.email?.stringValue || '',
          rank: f.rank?.stringValue || 'G0',
          referredBy: f.referredBy?.stringValue || '',
          name: f.name?.stringValue || ''
      };
  });
  
  // Find btc001
  let btc001 = usersList.find(u => u.id === 'btc001' || u.email.includes('btc001'));
  
  let level1 = usersList.filter(u => u.referredBy === btc001.uid);
  console.log("btc001 direct downlines (Depth 1):");
  level1.forEach(u => {
      console.log(`- ${u.id || u.email} / ${u.name} (Rank: ${u.rank})`);
  });
  
  // Check moodo9569
  let moodo = usersList.find(u => u.id === 'moodo9569' || u.email.includes('moodo9569'));
  let mLevel1 = usersList.filter(u => u.referredBy === moodo.uid);
  console.log("\nmoodo9569 direct downlines (Depth 1):");
  mLevel1.forEach(u => {
      console.log(`- ${u.id || u.email} / ${u.name} (Rank: ${u.rank})`);
  });
}
run().catch(console.error);
