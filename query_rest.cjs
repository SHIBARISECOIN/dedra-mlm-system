const admin = require('firebase-admin');

const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDE2u5iT6K6e5F8\ny0QeS8gG4p+Y2+bUqj+8xTjU/m8T2/n3x3V/O6J6Y2B+8M7v2b2j4s7V/7VzQ4n+\nuP+N2t/B1F6k/8X6w/2T1m6Z9F9l6/0+z5/w8J3d/j4I6V+U3Y6n/M6R/2b7I+S+\nu+U/2W1Y9g0b+P2v2M5D1k/C+I9N0v8b+w/M4w3z/S+I2f0W7Z/I/2I7w9m4I/P\nuP2e2N/Y/M2b/Y2c/P4v/E8I/K2x/w+X+O/P/Q/T/Q4O/P9D/P/W9I3J4z/2M9I/\nP8c4M3P/P4e/P/M4e/Q8O2K/M/P4e+P/L+T/L/M4Z/R+K+C/M+M4P/D4P4O/Q/Q/\nP4E/L4D7AgMBAAECggEAf+L8w/z+c4K+c3M2I7m4D/J7O6H/O3K2b9n8M+e8P/B\nuM6M7O6P/Q/C7P8G+J8R4D+M7O3J6e5M8I+L9K9O2M5J3P/K9L8P/I+O4R+M+C/\nL3P4H/M7C+M+T+E4D/N6P9N4P+J5M6M/D3K4P4P+L+O4J4I/M4D/C4P9O4P+K/\nL4O/J4P+M/D+C/H+J8O+P/C+P+P/C+I+L/C/O4O4R4P/N+O4M+J4O+L+M4J+C/\nL4O4M4P+O4P/K+O4P+K4O/O4P4J+N4D+P4P+K/N4D4P4P+N/P4O+J+O4M+C/O4\nP4P+D+K/J4D4P/O+J+J/J/O4D4P+D+O/P/K+J+J+N4D/C/P+D+O4P+P/O4D+K/\nM4D+J+M4P+K4M4D4P+K4D4J4P4D4P/J4D4D+P4M4D4P/J/O4D/C4O4P4P+K/N\n-----END PRIVATE KEY-----\n`.replace(/\\n/g, '\n'),
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  client_id: "103096684164693920388",
  token_uri: "https://oauth2.googleapis.com/token"
};

async function getAdminToken() {
  const jwt = require('jsonwebtoken');
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/identitytoolkit'
  };
  const token = jwt.sign(payload, SERVICE_ACCOUNT.private_key, { algorithm: 'RS256' });
  const res = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get token: ' + JSON.stringify(data));
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

async function fsQuery(collection, token, limit=1000, orderBy=null, direction='DESCENDING') {
  let query = {
    from: [{ collectionId: collection }],
    limit: limit
  };
  if (orderBy) {
    query.orderBy = [{ field: { fieldPath: orderBy }, direction }];
  }
  
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ structuredQuery: query })
  });
  
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Query failed');
  }
  
  const data = await res.json();
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
    console.log("Got token.");
    
    // Fetch last 5000 bonuses (maybe type roi)
    const bonuses = await fsQuery('bonuses', token, 5000, 'createdAt', 'DESCENDING');
    console.log(`Fetched ${bonuses.length} bonuses.`);
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const userMap = {};
    let roiCount = 0;
    
    for (const doc of bonuses) {
      if (doc.type === 'roi' && doc.createdAt >= startOfToday) {
        roiCount++;
        const userId = doc.userId;
        if (!userMap[userId]) userMap[userId] = { totalPaid: 0, count: 0, reasons: [] };
        userMap[userId].totalPaid += Number(doc.amount || 0);
        userMap[userId].count++;
        userMap[userId].reasons.push(doc.reason || '');
      }
    }
    
    console.log(`Found ${roiCount} ROI bonuses for today.`);
    const activeUsers = Object.keys(userMap);
    console.log(`Unique users paid today: ${activeUsers.length}`);
    
    // Fetch all investments and build a map
    const invs = await fsQuery('investments', token, 10000);
    console.log(`Fetched ${invs.length} investments.`);
    
    const invMap = {};
    for (const inv of invs) {
      if (inv.status === 'active') {
        if (!invMap[inv.userId]) invMap[inv.userId] = 0;
        invMap[inv.userId] += Number(inv.amount || inv.amountUsdt || 0);
      }
    }
    
    let totalPrincipalOverall = 0;
    let totalPaidOverall = 0;
    const results = [];
    
    for (const uId of activeUsers) {
      const principal = invMap[uId] || 0;
      const paid = userMap[uId].totalPaid;
      const ratio = principal > 0 ? (paid / principal) * 100 : 0;
      
      totalPrincipalOverall += principal;
      totalPaidOverall += paid;
      
      // try to figure out days applied by looking at reason: "Daily profit (... / 10-day(s))"
      let maxDays = 1;
      for (const r of userMap[uId].reasons) {
         const match = r.match(/(\d+)-day/);
         if (match && Number(match[1]) > maxDays) maxDays = Number(match[1]);
      }
      
      results.push({
          userId: uId,
          principal,
          paid,
          ratio,
          count: userMap[uId].count,
          days: maxDays
      });
    }
    
    // Sort by ratio desc
    results.sort((a, b) => b.ratio - a.ratio);
    
    console.log("\n=== TOP 20 USERS BY PAYOUT RATIO ===");
    console.log("UserID | Principal | Paid | Ratio | Days | Count");
    results.slice(0, 20).forEach(r => {
        console.log(`${r.userId} | $${r.principal.toFixed(2)} | $${r.paid.toFixed(2)} | ${r.ratio.toFixed(2)}% | ${r.days}d | ${r.count}`);
    });
    
    console.log("\n=== SUMMARY ===");
    console.log(`Total Users Paid: ${results.length}`);
    console.log(`Total ROI Paid: $${totalPaidOverall.toFixed(2)}`);
    console.log(`Total Active Principal of these users: $${totalPrincipalOverall.toFixed(2)}`);
    console.log(`Average Payout Ratio: ${totalPrincipalOverall > 0 ? (totalPaidOverall / totalPrincipalOverall * 100).toFixed(2) : 0}%`);
    
    const overpaid = results.filter(r => r.ratio > 5); // more than 5%
    console.log(`\nUsers with >5% payout ratio: ${overpaid.length}`);
    
    const fs = require('fs');
    fs.writeFileSync('/home/user/webapp/today_bonus_report_rest.json', JSON.stringify(results, null, 2));
    
  } catch(e) {
    console.error(e);
  }
}
run();
