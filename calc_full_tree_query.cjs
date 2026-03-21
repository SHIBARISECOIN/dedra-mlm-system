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
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: account.client_email,
    sub: account.client_email,
    aud: account.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'
  })).toString('base64url');

  const signatureInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign(account.private_key, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get token: ' + JSON.stringify(data));
  return data.access_token;
}

function convertValue(val) {
  if (!val) return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = convertValue(v);
    }
    return obj;
  }
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(convertValue);
  }
  if ('nullValue' in val) return null;
  return val;
}

async function runQueryAll(collection, token) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        limit: 2000
      }
    })
  });
  const data = await res.json();
  const docs = [];
  data.forEach(item => {
    if (item.document) {
      let fields = item.document.fields || {};
      let parsed = {};
      for(const k in fields) { parsed[k] = convertValue(fields[k]); }
      parsed.id = item.document.name.split('/').pop();
      docs.push(parsed);
    }
  });
  return docs;
}

async function run() {
  const token = await getAdminToken();
  const users = await runQueryAll('users', token);
  const wallets = await runQueryAll('wallets', token);
  
  const wMap = {};
  wallets.forEach(w => wMap[w.id] = w);

  const childrenMap = new Map();
  users.forEach(u => childrenMap.set(u.id, []));
  users.forEach(u => {
    const ref = u.referredBy;
    if (ref && childrenMap.has(ref)) {
      childrenMap.get(ref).push(u);
    }
  });

  function calcSubVolume(uid) {
    const children = childrenMap.get(uid) || [];
    let vol = 0;
    for (const child of children) {
      let childInv = wMap[child.id]?.totalInvest || wMap[child.id]?.totalInvested || 0;
      vol += childInv + calcSubVolume(child.id);
    }
    return vol;
  }

  let uid = 'qAdGKU772oVGZ0B5PwUEbL3UqSF3';
  const cyj = users.find(u => u.id === uid) || {name: 'Unknown', email: 'unknown'};
  const myInv = wMap[uid]?.totalInvest || wMap[uid]?.totalInvested || 0;
  
  console.log(`User: ${cyj.name} (${cyj.email}), My Invest: $${myInv}`);
  
  const children = childrenMap.get(uid) || [];
  console.log(`Direct Legs: ${children.length}`);
  
  const legs = [];
  for (const child of children) {
    let childInv = wMap[child.id]?.totalInvest || wMap[child.id]?.totalInvested || 0;
    let subVol = calcSubVolume(child.id);
    let totalVol = childInv + subVol;
    legs.push({ name: child.name, email: child.email, volume: totalVol });
  }
  
  legs.sort((a, b) => b.volume - a.volume);
  legs.forEach((l, i) => {
    console.log(`Leg ${i+1} (${l.name}): $${l.volume}`);
  });
}

run().catch(console.error);
