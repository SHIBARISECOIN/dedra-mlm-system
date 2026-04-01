const fs = require('fs');
const crypto = require('crypto');

const indexCode = fs.readFileSync('./src/index.tsx', 'utf8');
const saMatch = indexCode.match(/const SERVICE_ACCOUNT\s*=\s*({[\s\S]*?\n})/);
const sa = eval('(' + saMatch[1] + ')');

async function getAdminToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: sa.client_email, sub: sa.client_email, aud: sa.token_uri, iat: now, exp: now + 3600, scope: 'https://www.googleapis.com/auth/datastore' };
  const unsigned = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256'); sign.update(unsigned);
  const signature = sign.sign(sa.private_key).toString('base64url');
  
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${signature}` });
  const data = await res.json();
  return data.access_token;
}

async function run() {
  try {
    const token = await getAdminToken();
    const projectId = sa.project_id;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'btc100' } } },
        limit: 1
      }
    };
    
    const userRes = await fetch(`${baseUrl}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    const userResult = await userRes.json();
    const userId = userResult[0].document.name.split('/').pop();
    
    const bQuery = {
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
        limit: 10000
      }
    };
    
    const bRes = await fetch(`${baseUrl}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(bQuery) });
    const bonuses = await bRes.json();
    
    let rankData = {};
    for (const b of bonuses) {
      if (!b.document) continue;
      const fields = b.document.fields;
      if (!fields.createdAt) continue;
      const d = new Date(fields.createdAt.timestampValue);
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const date = kst.toISOString().split('T')[0];
      const type = fields.type?.stringValue || 'unknown';
      if (type === 'rank_bonus' || type === 'rank_matching') {
         if (!rankData[date]) rankData[date] = [];
         rankData[date].push(fields.fromUserId?.stringValue);
      }
    }
    
    const d0331 = rankData['2026-03-31'] || [];
    const d0401 = rankData['2026-04-01'] || [];
    
    const dropouts = d0331.filter(id => !d0401.includes(id));
    console.log(`Users dropping out from 03-31 to 04-01: ${dropouts.length}`);
    
    // Check one dropout
    if (dropouts.length > 0) {
       const uQuery = {
         structuredQuery: {
           from: [{ collectionId: 'users' }],
           where: { fieldFilter: { field: { fieldPath: '__name__' }, op: 'EQUAL', value: { referenceValue: `projects/${projectId}/databases/(default)/documents/users/${dropouts[0]}` } } },
           limit: 1
         }
       };
       const uRes = await fetch(`${baseUrl}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(uQuery) });
       const usr = await uRes.json();
       if (usr && usr[0] && usr[0].document) {
          const fields = usr[0].document.fields;
          console.log(`\nDropout User ${fields.username?.stringValue} (ID: ${dropouts[0]})`);
          console.log(` - totalEarnings: ${fields.totalEarnings?.doubleValue || fields.totalEarnings?.integerValue}`);
          console.log(` - totalDeposit: ${fields.totalDeposit?.doubleValue || fields.totalDeposit?.integerValue}`);
          console.log(` - daily_dividend: ${fields.daily_dividend?.doubleValue || fields.daily_dividend?.integerValue}`);
       }
    }

  } catch(e) {
    console.error(e);
  }
}
run();
