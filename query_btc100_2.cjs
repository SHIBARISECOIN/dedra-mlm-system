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
    
    // Find btc100 user ID
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'username' },
            op: 'EQUAL',
            value: { stringValue: 'btc100' }
          }
        },
        limit: 1
      }
    };
    
    const userRes = await fetch(`${baseUrl}:runQuery`, { 
      method: 'POST', 
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    const userResult = await userRes.json();
    const docPath = userResult[0].document.name;
    const userId = docPath.split('/').pop();
    
    // Now get bonuses for btc100
    const bQuery = {
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
              { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'rank_bonus' } } },
            ]
          }
        },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 2000
      }
    };
    
    const bRes = await fetch(`${baseUrl}:runQuery`, { 
      method: 'POST', 
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bQuery)
    });
    const bonuses = await bRes.json();
    
    let countByDate = {};
    for (const b of bonuses) {
      if (!b.document) continue;
      const fields = b.document.fields;
      let date = "Unknown";
      if (fields.createdAt && fields.createdAt.timestampValue) {
         const d = new Date(fields.createdAt.timestampValue);
         const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
         date = kst.toISOString().split('T')[0];
      }
      if (!countByDate[date]) countByDate[date] = [];
      countByDate[date].push({
        amount: fields.amount?.doubleValue || fields.amount?.integerValue,
        reason: fields.reason?.stringValue,
        fromUserId: fields.fromUserId?.stringValue
      });
    }
    
    console.log("=== Rank Bonuses grouped by Date (KST) ===");
    for (const [date, list] of Object.entries(countByDate)) {
      console.log(`[${date}]: ${list.length} 건`);
    }
    
    const keys = Object.keys(countByDate).sort().reverse();
    if (keys.length >= 2) {
      const today = keys[0];
      const yesterday = keys[1];
      console.log(`\nDiff analysis: ${today} (${countByDate[today].length}) vs ${yesterday} (${countByDate[yesterday].length})`);
      
      const tIds = countByDate[today].map(x => x.fromUserId);
      const yIds = countByDate[yesterday].map(x => x.fromUserId);
      
      const onlyYesterday = yIds.filter(id => !tIds.includes(id));
      const onlyToday = tIds.filter(id => !yIds.includes(id));
      
      console.log(`\nIn ${yesterday} but not in ${today}: ${onlyYesterday.length} users`);
      onlyYesterday.slice(0, 20).forEach(uid => {
         const entry = countByDate[yesterday].find(x => x.fromUserId === uid);
         console.log(` - User ${uid}: ${entry.reason}`);
      });
      if(onlyYesterday.length > 20) console.log('   ...and more');
      
      console.log(`\nIn ${today} but not in ${yesterday}: ${onlyToday.length} users`);
      onlyToday.slice(0, 20).forEach(uid => {
         const entry = countByDate[today].find(x => x.fromUserId === uid);
         console.log(` - User ${uid}: ${entry.reason}`);
      });
      if(onlyToday.length > 20) console.log('   ...and more');
    }

  } catch(e) {
    console.error(e);
  }
}
run();
