const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');

const SERVICE_ACCOUNT = JSON.parse(fs.readFileSync('/home/user/webapp/firebase-service-account.json', 'utf8'));

async function getAdminToken() {
  const account = SERVICE_ACCOUNT;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: account.client_email, sub: account.client_email, aud: account.token_uri,
    iat: now, exp: now + 3600, scope: 'https://www.googleapis.com/auth/datastore'
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
  if (!v) return null;
  if ('integerValue' in v) return parseInt(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

async function run() {
  const token = await getAdminToken();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  console.log("Fetching recent settlements...");
  let res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 1500
      }
    })
  });
  let data = await res.json();
  let bonuses = data.filter(d => d.document).map(d => {
    const fields = d.document.fields || {};
    return {
      userId: fromFirestoreValue(fields.userId),
      amountUsdt: fromFirestoreValue(fields.amountUsdt),
      reason: fromFirestoreValue(fields.reason),
      type: fromFirestoreValue(fields.type),
      createdAt: fromFirestoreValue(fields.createdAt)
    };
  }).filter(b => b.createdAt >= oneDayAgo && b.type === 'roi');
  console.log(`Fetched ${bonuses.length} ROI bonuses.`);

  res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'investments' }],
        limit: 1500
      }
    })
  });
  data = await res.json();
  let invs = data.filter(d => d.document).map(d => {
    const fields = d.document.fields || {};
    return {
      userId: fromFirestoreValue(fields.userId),
      amountUsdt: fromFirestoreValue(fields.amountUsdt) || fromFirestoreValue(fields.amount),
      status: fromFirestoreValue(fields.status)
    };
  }).filter(i => i.status === 'active');

  const userMap = {};
  for (const b of bonuses) {
    if (!userMap[b.userId]) userMap[b.userId] = { totalRoiUsdt: 0, days: [] };
    userMap[b.userId].totalRoiUsdt += (b.amountUsdt || 0);
    const m = (b.reason || '').match(/(\d+)일치/);
    if (m) userMap[b.userId].days.push(m[1]);
  }
  
  for (const inv of invs) {
    if (!userMap[inv.userId]) continue;
    userMap[inv.userId].principal = (userMap[inv.userId].principal || 0) + (inv.amountUsdt || 0);
  }
  
  const results = Object.keys(userMap).map(uid => {
    const d = userMap[uid];
    const p = d.principal || 0;
    return {
      userId: uid,
      principal: p.toFixed(2),
      payout: d.totalRoiUsdt.toFixed(2),
      ratio: p > 0 ? ((d.totalRoiUsdt / p) * 100).toFixed(2) + '%' : '0.00%',
      daysApplied: d.days.join(',')
    };
  }).sort((a,b) => parseFloat(b.payout) - parseFloat(a.payout));

  console.table(results.slice(0, 20));
  let total = 0, over = 0;
  for (const r of results) {
    total += parseFloat(r.payout);
    if (parseFloat(r.ratio) > 5) over++;
  }
  console.log(`Total Paid ROI Today: $${total.toFixed(2)}`);
  console.log(`Overpaid (>5%): ${over} users`);
}
run().catch(console.error);
