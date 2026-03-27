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
  
  const qUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents:runQuery";

  let uRes = await fetch(qUrl, {
    method: 'POST', headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        limit: 10000
      }
    })
  });
  let uData = await uRes.json();
  
  const targetUsernames = ['btc001', 'moodo9569'];
  let usersList = uData.filter(d => d.document).map(d => {
      let uid = d.document.name.split('/').pop();
      let f = d.document.fields;
      return {
          uid,
          id: f.id?.stringValue || '',
          email: f.email?.stringValue || '',
          rank: f.rank?.stringValue || 'G0',
          referredBy: f.referredBy?.stringValue || ''
      };
  });
  
  let map = new Map();
  usersList.forEach(u => map.set(u.uid, u));
  
  // Find downlines recursively
  function getDownlines(uid, depth = 1) {
      let result = [];
      for (let u of usersList) {
          if (u.referredBy === uid) {
              result.push({ ...u, depth });
              result.push(...getDownlines(u.uid, depth + 1));
          }
      }
      return result;
  }
  
  for (let tu of targetUsernames) {
      let user = usersList.find(u => u.id === tu || u.email.includes(tu));
      if (!user) continue;
      
      console.log(`\n=== User: ${user.id} (Rank: ${user.rank}) ===`);
      let downlines = getDownlines(user.uid);
      
      let rankCounts = {};
      downlines.forEach(d => {
          rankCounts[d.rank] = (rankCounts[d.rank] || 0) + 1;
      });
      console.log(`Downlines Count: ${downlines.length}`);
      console.log(`Downlines Rank distribution:`, rankCounts);
      
      let highRanks = downlines.filter(d => d.rank !== 'G0' && d.rank !== 'G1');
      console.log("High rank downlines:");
      highRanks.sort((a,b) => a.depth - b.depth).forEach(d => {
          console.log(`  Depth ${d.depth}: ${d.id} (Rank: ${d.rank})`);
      });
  }
}
run().catch(console.error);
