const SERVICE_ACCOUNT = {
  project_id: "dedra-mlm",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token"
};

const jwt = require('jsonwebtoken');

async function getAdminToken() {
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

async function fsQueryFast(collection, token, limit=10000) {
  let query = {
    from: [{ collectionId: collection }],
    limit: limit,
    orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }]
  };
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
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
    const bonuses = await fsQueryFast('bonuses', token, 20000);
    
    const startOfToday = new Date(Date.now() - 24*3600*1000);
    startOfToday.setHours(0, 0, 0, 0);
    
    const userMap = {};
    let roiCount = 0;
    
    for (const doc of bonuses) {
      if (doc.type === 'roi' && new Date(doc.createdAt) >= startOfToday) {
        roiCount++;
        const userId = doc.userId;
        if (!userMap[userId]) userMap[userId] = { paid: 0, reasons: [] };
        userMap[userId].paid += Number(doc.amountUsdt || doc.amount || 0);
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
    console.log("UserID | Principal | Paid | Ratio | Days | Reason");
    results.slice(0, 20).forEach(r => {
        console.log(`${r.userId} | $${r.principal.toFixed(2)} | $${r.paid.toFixed(2)} | ${r.ratio.toFixed(2)}% | ${r.days}d | ${userMap[r.userId].reasons[0]}`);
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
