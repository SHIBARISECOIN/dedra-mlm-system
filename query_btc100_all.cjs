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
    console.log(`btc100 ID: ${userId}`);
    
    // Now get ALL bonuses for btc100
    const bQuery = {
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        where: {
          fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } }
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
    
    let stats = {};
    let latestTypeData = {};
    for (const b of bonuses) {
      if (!b.document) continue;
      const fields = b.document.fields;
      let date = "Unknown";
      if (fields.createdAt && fields.createdAt.timestampValue) {
         const d = new Date(fields.createdAt.timestampValue);
         const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
         date = kst.toISOString().split('T')[0];
      }
      const type = fields.type?.stringValue || 'unknown';
      if (!stats[date]) stats[date] = {};
      if (!stats[date][type]) stats[date][type] = 0;
      stats[date][type]++;
      
      if (!latestTypeData[date]) latestTypeData[date] = [];
      if (type === 'rank_bonus' || type.includes('rank')) {
         latestTypeData[date].push({
           type: type,
           fromUserId: fields.fromUserId?.stringValue,
           reason: fields.reason?.stringValue
         });
      }
    }
    
    console.log("=== Bonuses grouped by Date (KST) ===");
    for (const [date, types] of Object.entries(stats)) {
      console.log(`[${date}]:`, types);
    }
    
    // Analyze rank related differences between the top 2 dates
    const dates = Object.keys(stats).sort().reverse();
    if (dates.length >= 2) {
       const d1 = dates[0];
       const d2 = dates[1];
       console.log(`\nAnalyzing Rank difference between ${d1} and ${d2}`);
       const d1Ranks = latestTypeData[d1] || [];
       const d2Ranks = latestTypeData[d2] || [];
       
       const d1Ids = d1Ranks.map(x => x.fromUserId);
       const d2Ids = d2Ranks.map(x => x.fromUserId);
       
       const lost = d2Ids.filter(id => !d1Ids.includes(id));
       const gained = d1Ids.filter(id => !d2Ids.includes(id));
       
       console.log(`\nUsers contributing to rank bonus on ${d2} but NOT on ${d1}: ${lost.length}`);
       lost.slice(0, 10).forEach(uid => {
          const entry = d2Ranks.find(x => x.fromUserId === uid);
          console.log(` - ${uid}: ${entry.reason}`);
       });
       
       console.log(`\nUsers contributing to rank bonus on ${d1} but NOT on ${d2}: ${gained.length}`);
       gained.slice(0, 10).forEach(uid => {
          const entry = d1Ranks.find(x => x.fromUserId === uid);
          console.log(` - ${uid}: ${entry.reason}`);
       });
    }

  } catch(e) {
    console.error(e);
  }
}
run();
