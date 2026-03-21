const crypto = require('crypto');
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token"
};
async function getAdminToken() {
  const account = SERVICE_ACCOUNT;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: account.client_email, sub: account.client_email, aud: account.token_uri, iat: now, exp: now + 3600, scope: 'https://www.googleapis.com/auth/datastore' };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const sigInput = `${b64url(header)}.${b64url(payload)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(sigInput);
  const signature = signer.sign(account.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const res = await fetch(account.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sigInput}.${signature}` });
  return (await res.json()).access_token;
}
function fromFirestoreValue(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('stringValue' in val) return val.stringValue;
  return val;
}
async function fsQueryAll(collection, token) {
  let query = { from: [{ collectionId: collection }], limit: 10000 };
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query })
  });
  const data = await res.json();
  if(!Array.isArray(data)) return [];
  return data.filter(d => d.document).map(d => {
    const id = d.document.name.split('/').pop();
    const obj = { id };
    for (const k in d.document.fields) obj[k] = fromFirestoreValue(d.document.fields[k]);
    return obj;
  });
}
async function run() {
  const token = await getAdminToken();
  const bonuses = await fsQueryAll('bonuses', token);
  const transactions = await fsQueryAll('transactions', token);
  const withdrawals = await fsQueryAll('withdrawals', token);
  const wallets = await fsQueryAll('wallets', token);
  
  const userBonuses = {};
  const userTxDeltas = {};
  const userWds = {};
  
  for (const b of bonuses) {
    if (!b.userId) continue;
    if (!userBonuses[b.userId]) userBonuses[b.userId] = 0;
    userBonuses[b.userId] += Number(b.amountUsdt !== undefined ? b.amountUsdt : b.amount || 0);
  }
  
  for (const t of transactions) {
    if (!t.userId) continue;
    if (t.type === 'admin_adjust' && t.field === 'bonusBalance' && t.status === 'approved') {
      if (!userTxDeltas[t.userId]) userTxDeltas[t.userId] = 0;
      userTxDeltas[t.userId] += Number(t.delta || 0);
    }
    // manual_adjust changes usdtBalance, not bonusBalance usually. Let's check:
    if (t.type === 'manual_adjust' && t.walletType === 'bonusBalance') {
       if (!userTxDeltas[t.userId]) userTxDeltas[t.userId] = 0;
       userTxDeltas[t.userId] += Number(t.amount || 0);
    }
  }
  
  for (const w of withdrawals) {
    if (!w.userId) continue;
    if (w.status === 'approved' || w.status === 'pending') { // Assuming pending has already deducted from balance? Usually it does. Let's assume approved or pending means deducted.
      if (!userWds[w.userId]) userWds[w.userId] = 0;
      userWds[w.userId] += Number(w.amount || 0); // Wait, withdrawals amount might be in USDT or DDRA? Let's check w.amount.
    }
  }
  
  console.log("Found withdrawals:", withdrawals.map(w => ({ id: w.id, uid: w.userId, amt: w.amount, status: w.status })).slice(0, 5));
  
  const affectedUsers = [];
  for (const w of wallets) {
    const uid = w.id;
    const actualTotalEarnings = userBonuses[uid] || 0;
    
    // According to the bug, totalEarnings was improperly reduced by deduction.
    // If it's less than actual TotalEarnings, they were affected.
    if (actualTotalEarnings > Number(w.totalEarnings || 0) + 0.1) {
      const calculatedBonus = actualTotalEarnings + (userTxDeltas[uid] || 0) - (userWds[uid] || 0);
      
      affectedUsers.push({
        uid,
        currentTotalEarnings: Number(w.totalEarnings || 0),
        newTotalEarnings: actualTotalEarnings,
        currentBonusBalance: Number(w.bonusBalance || 0),
        newBonusBalance: Math.max(0, calculatedBonus),
        bonuses: actualTotalEarnings,
        txDeltas: userTxDeltas[uid] || 0,
        wds: userWds[uid] || 0
      });
    }
  }
  console.log(`Need to fix ${affectedUsers.length} users`);
  console.log(affectedUsers.slice(0, 10));
}
run();
