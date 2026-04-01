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
          fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'btc100' } }
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
        limit: 10000
      }
    };
    
    const bRes = await fetch(`${baseUrl}:runQuery`, { 
      method: 'POST', 
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bQuery)
    });
    const bonuses = await bRes.json();
    console.log(`Received ${bonuses.length} items from runQuery (bonuses)`);
    
    if (bonuses.length > 0 && bonuses[0].error) {
       console.error("Error from runQuery:", JSON.stringify(bonuses[0].error));
       return;
    }
    
    let stats = {};
    let rankData = {};
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
      
      if (type === 'rank_bonus' || type === 'rank_matching') {
         if (!rankData[date]) rankData[date] = [];
         rankData[date].push({
           fromUserId: fields.fromUserId?.stringValue,
           reason: fields.reason?.stringValue
         });
      }
    }
    
    console.log("\n=== Bonuses grouped by Date (KST) ===");
    const dates = Object.keys(stats).sort().reverse();
    for (const date of dates) {
      console.log(`[${date}]:`, stats[date]);
    }
    
    // Detailed analysis for the last two days (probably 04-02 vs 04-01)
    if (dates.length >= 2) {
      const today = dates[0];
      const yesterday = dates[1];
      
      const tIds = (rankData[today] || []).map(x => x.fromUserId);
      const yIds = (rankData[yesterday] || []).map(x => x.fromUserId);
      
      const onlyYesterday = yIds.filter(id => !tIds.includes(id));
      const onlyToday = tIds.filter(id => !yIds.includes(id));
      
      console.log(`\n=== Difference in Rank Bonuses ==`);
      console.log(`Lost users (${onlyYesterday.length}) - Present on ${yesterday} but missing on ${today}:`);
      onlyYesterday.slice(0, 20).forEach(uid => {
         const entry = rankData[yesterday].find(x => x.fromUserId === uid);
         console.log(` - ${uid}: ${entry.reason}`);
      });
      if(onlyYesterday.length > 20) console.log('   ...and more');
      
      console.log(`\nGained users (${onlyToday.length}) - Present on ${today} but missing on ${yesterday}:`);
      onlyToday.slice(0, 20).forEach(uid => {
         const entry = rankData[today].find(x => x.fromUserId === uid);
         console.log(` - ${uid}: ${entry.reason}`);
      });
      if(onlyToday.length > 20) console.log('   ...and more');
    }

  } catch(e) {
    console.error(e);
  }
}
run();
