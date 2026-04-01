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
      if (type === 'rank_bonus' || type === 'rank_matching') {
         if (!rankData[date]) rankData[date] = [];
         rankData[date].push({
           fromUserId: fields.fromUserId?.stringValue,
           reason: fields.reason?.stringValue
         });
      }
    }
    
    const d0402 = (rankData['2026-04-02'] || []).map(x => x.fromUserId);
    const d0401 = (rankData['2026-04-01'] || []).map(x => x.fromUserId);
    const d0331 = (rankData['2026-03-31'] || []).map(x => x.fromUserId);
    
    const onlyToday = d0402.filter(id => !d0401.includes(id));
    console.log(`Out of the ${onlyToday.length} users gained on 04-02:`);
    let presentOn0331 = 0;
    for (const uid of onlyToday) {
       if (d0331.includes(uid)) {
          presentOn0331++;
       }
    }
    console.log(`- How many were present on 03-31? ${presentOn0331}`);
    
    // Also, why didn't they give bonus on 04-01? Did they get ROI on 04-01?
    // Let's check ROI for one of those users on 04-01.
    const sampleUid = onlyToday[0];
    console.log(`\nLet's check user ${sampleUid} ROI bonuses on these dates:`);
    
    const roiQuery = {
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        where: {
          compositeFilter: {
             op: 'AND',
             filters: [
                { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: sampleUid } } },
                { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'roi' } } }
             ]
          }
        },
        limit: 100
      }
    };
    
    const roiRes = await fetch(`${baseUrl}:runQuery`, { 
      method: 'POST', 
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(roiQuery)
    });
    const rois = await roiRes.json();
    for(const r of rois) {
       if(!r.document) continue;
       const fields = r.document.fields;
       const d = new Date(fields.createdAt.timestampValue);
       const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
       console.log(` ROI on ${kst.toISOString().split('T')[0]}: ${fields.amountUsdt?.doubleValue || fields.amountUsdt?.integerValue} USDT`);
    }

  } catch(e) {
    console.error(e);
  }
}
run();
