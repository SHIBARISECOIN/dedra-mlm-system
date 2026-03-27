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

  const users = ['btc001', 'moodo9569'];
  for (let u of users) {
      let uid = null;
      let uRes = await fetch(qUrl, {
        method: 'POST', headers,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: { fieldFilter: { field: { fieldPath: 'id' }, op: 'EQUAL', value: { stringValue: u } } },
            limit: 1
          }
        })
      });
      let uData = await uRes.json();
      if (uData[0] && uData[0].document) {
          uid = uData[0].document.name.split('/').pop();
      }
      
      console.log(`\n=== Analyzing ${u} (${uid}) ===`);
      if (!uid) {
          console.log("Could not find uid.");
          continue;
      }

      let bRes = await fetch(qUrl, {
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
             amountUsdt: f.amountUsdt?.numberValue || f.amountUsdt?.integerValue || parseFloat(f.amountUsdt?.stringValue || '0'),
             date: f.createdAt?.timestampValue || f.settlementDate?.stringValue || '',
             reason: f.reason?.stringValue
         };
      });
      
      let dates = {};
      for (let b of bonuses) {
          if (!b.date) continue;
          let d = b.date.substring(0, 10);
          if (d >= '2026-03-17' && d <= '2026-03-24') {
              if (!dates[d]) dates[d] = { total: 0, rank_bonus: 0, rank_matching: 0, recommend_bonus: 0, other: 0 };
              dates[d].total += b.amountUsdt;
              if (b.type === 'rank_bonus') dates[d].rank_bonus += b.amountUsdt;
              else if (b.type === 'rank_matching') dates[d].rank_matching += b.amountUsdt;
              else if (b.type === 'direct_bonus') dates[d].recommend_bonus += b.amountUsdt;
              else dates[d].other += b.amountUsdt;
          }
      }
      
      const sortedDates = Object.keys(dates).sort();
      for (let d of sortedDates) {
          console.log(`${d}: Total=${dates[d].total.toFixed(4)}, RankBonus=${dates[d].rank_bonus.toFixed(4)}, RankMatching=${dates[d].rank_matching.toFixed(4)}, Direct=${dates[d].recommend_bonus.toFixed(4)}, Other=${dates[d].other.toFixed(4)}`);
      }
  }
}
run().catch(console.error);
