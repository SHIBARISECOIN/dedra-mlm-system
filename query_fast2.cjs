const fs = require('fs');
const content = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
if (!match) {
  console.error("SERVICE_ACCOUNT not found in index.tsx");
  process.exit(1);
}
let saStr = match[1];
// very basic parse
const sa = eval('(' + saStr + ')');

const jwt = require('jsonwebtoken');

async function getAdminToken() {
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/identitytoolkit'
  };
  const token = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });
  const data = await res.json();
  return data.access_token;
}

function fromFirestoreValue(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return new Date(val.timestampValue);
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(v => fromFirestoreValue(v));
  if ('mapValue' in val) {
    const obj = {};
    for (const k in val.mapValue.fields) {
      obj[k] = fromFirestoreValue(val.mapValue.fields[k]);
    }
    return obj;
  }
  return val;
}

async function fsQueryFast(collection, token, limit=1000) {
  let query = {
    from: [{ collectionId: collection }],
    limit: limit,
    orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }]
  };
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query })
  });
  const data = await res.json();
  if(!Array.isArray(data)) return [];
  return data.filter(d => d.document).map(d => {
    const id = d.document.name.split('/').pop();
    const obj = { id };
    for (const k in d.document.fields) {
      obj[k] = fromFirestoreValue(d.document.fields[k]);
    }
    return obj;
  });
}

async function run() {
  try {
    const token = await getAdminToken();
    console.log("Token acquired, fetching recent bonuses...");
    const bonuses = await fsQueryFast('bonuses', token, 4000);
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const userMap = {};
    let roiCount = 0;
    
    for (const doc of bonuses) {
      if (doc.type === 'roi' && doc.createdAt >= startOfToday) {
        roiCount++;
        const userId = doc.userId;
        if (!userMap[userId]) userMap[userId] = { paid: 0, reasons: [] };
        userMap[userId].paid += Number(doc.amount || 0);
        userMap[userId].reasons.push(doc.reason || '');
      }
    }
    
    console.log(`Found ${roiCount} ROI bonuses for today across ${Object.keys(userMap).length} users.`);
    
    console.log("Fetching active investments...");
    const invs = await fsQueryFast('investments', token, 6000);
    
    const invMap = {};
    for (const inv of invs) {
      if (inv.status === 'active') {
        if (!invMap[inv.userId]) invMap[inv.userId] = 0;
        invMap[inv.userId] += Number(inv.amount || inv.amountUsdt || 0);
      }
    }
    
    const results = [];
    let totalPaid = 0;
    let totalPrin = 0;
    
    for (const uId of Object.keys(userMap)) {
      const prin = invMap[uId] || 0;
      const pd = userMap[uId].paid;
      const ratio = prin > 0 ? (pd / prin) * 100 : 0;
      totalPaid += pd;
      totalPrin += prin;
      
      let days = 1;
      for (const r of userMap[uId].reasons) {
         const m = r.match(/(\d+)-day/);
         if (m && Number(m[1]) > days) days = Number(m[1]);
      }
      
      results.push({ userId: uId, principal: prin, paid: pd, ratio, days });
    }
    
    results.sort((a,b) => b.ratio - a.ratio);
    
    console.log("\n=== TOP 20 PAYOUTS BY RATIO ===");
    console.log("UserID | Principal | Paid | Ratio | Days");
    results.slice(0, 20).forEach(r => {
        console.log(`${r.userId} | $${r.principal.toFixed(2)} | $${r.paid.toFixed(2)} | ${r.ratio.toFixed(2)}% | ${r.days}d`);
    });
    
    console.log("\n=== SUMMARY ===");
    console.log(`Users Paid: ${results.length}`);
    console.log(`Total Paid: $${totalPaid.toFixed(2)}`);
    console.log(`Matched Principal: $${totalPrin.toFixed(2)}`);
    console.log(`Average Ratio: ${totalPrin>0 ? (totalPaid/totalPrin*100).toFixed(2) : 0}%`);
    
  } catch(e) {
    console.error(e);
  }
}
run();
