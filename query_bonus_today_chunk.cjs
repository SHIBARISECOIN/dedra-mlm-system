const fs = require('fs');
const fetch = require('node-fetch');
const crypto = require('crypto');

const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  client_id: "103096684164693920388",
  token_uri: "https://oauth2.googleapis.com/token",
  project_id_full: "dedra-mlm"
};

async function getAdminToken() {
  const account = SERVICE_ACCOUNT;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: account.client_email, sub: account.client_email, aud: account.token_uri,
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore'
  };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const sigInput = `${b64url(header)}.${b64url(payload)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(sigInput);
  const signature = signer.sign(account.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const res = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sigInput}.${signature}`
  });
  return (await res.json()).access_token;
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;

function fromFirestoreValue(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) {
    const obj = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFirestoreValue(val);
    return obj;
  }
  return null;
}

function fsDocToObj(doc) {
  const id = doc.name.split('/').pop();
  const obj = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = fromFirestoreValue(v);
  return obj;
}

async function run() {
  const token = await getAdminToken();
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // We need today's ROI bonuses. Instead of pulling all 10000+, let's pull with a filter
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'bonuses' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'roi' } } }
          ]
        }
      },
      limit: 10000
    }
  };
  console.log("Fetching bonuses...");
  let res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryBody)
  });
  let data = await res.json();
  let bonuses = data.filter(d => d.document).map(d => fsDocToObj(d.document)).filter(b => b.createdAt && b.createdAt.startsWith(todayStr));
  console.log(`Found ${bonuses.length} ROI bonuses today.`);

  console.log("Fetching investments...");
  res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'investments' }],
        where: {
            fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } }
        },
        limit: 10000
      }
    })
  });
  data = await res.json();
  let invs = data.filter(d => d.document).map(d => fsDocToObj(d.document));
  console.log(`Found ${invs.length} active investments.`);

  const userMap = {};
  for (const b of bonuses) {
    if (!userMap[b.userId]) userMap[b.userId] = { totalRoiUsdt: 0, days: [] };
    userMap[b.userId].totalRoiUsdt += (b.amountUsdt || 0);
    const reasonMatch = (b.reason || '').match(/(\d+)일치/);
    if (reasonMatch) userMap[b.userId].days.push(parseInt(reasonMatch[1]));
  }
  
  for (const inv of invs) {
    if (!userMap[inv.userId]) continue;
    userMap[inv.userId].principal = (userMap[inv.userId].principal || 0) + (inv.amountUsdt || inv.amount || 0);
  }
  
  const results = Object.keys(userMap).map(uid => {
    const d = userMap[uid];
    const principal = d.principal || 0;
    const ratio = principal > 0 ? (d.totalRoiUsdt / principal) * 100 : 0;
    return {
      userId: uid,
      principal: principal.toFixed(2),
      payout: d.totalRoiUsdt.toFixed(2),
      ratio: ratio.toFixed(2) + '%',
      daysApplied: d.days.join(',')
    };
  }).sort((a, b) => parseFloat(b.payout) - parseFloat(a.payout));

  console.table(results.slice(0, 15));

  let totalPaid = 0;
  let overPaid = 0;
  for (const r of results) {
    totalPaid += parseFloat(r.payout);
    if (parseFloat(r.ratio) > 5) overPaid++;
  }
  
  console.log(`오늘 총 지급된 ROI: $${totalPaid.toFixed(2)}`);
  console.log(`원금 대비 5% 이상 지급된 유저 수: ${overPaid}명`);
}
run().catch(console.error);
