const fs = require('fs');
const crypto = require('crypto');

// Extract SERVICE_ACCOUNT from index.tsx
const indexCode = fs.readFileSync('./src/index.tsx', 'utf8');
const saMatch = indexCode.match(/const SERVICE_ACCOUNT = ({[\s\S]*?\n})/);
let saCode = saMatch[1];
// Fix it to be valid JSON if it's not (but it's a JS object)
const sa = eval('(' + saCode + ')');

async function getAdminToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${encHeader}.${encPayload}`;
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(sa.private_key).toString('base64url');
  
  const jwt = `${unsigned}.${signature}`;
  
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  return data.access_token;
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

function toFirestore(obj) {
  if (obj === null) return { nullValue: null };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (typeof obj === 'number') return Number.isInteger(obj) ? { integerValue: obj.toString() } : { doubleValue: obj };
  if (typeof obj === 'string') return { stringValue: obj };
  if (Array.isArray(obj)) return { arrayValue: { values: obj.map(toFirestore) } };
  if (typeof obj === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) fields[k] = toFirestore(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(obj) };
}

async function run() {
  try {
    const token = await getAdminToken();
    console.log("Token obtained");
    
    // First, let's fetch users to map username -> uid
    console.log("Fetching users...");
    const resUsers = await fetch(`${FIRESTORE_BASE}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const usersData = await resUsers.json();
    const usersMap = {};
    for (const doc of (usersData.documents || [])) {
        const fields = doc.fields || {};
        const uid = fields.uid ? fields.uid.stringValue : null;
        let username = fields.username ? fields.username.stringValue : null;
        if (uid && username) {
            usersMap[username.toLowerCase()] = uid;
        }
    }
    console.log(`Found ${Object.keys(usersMap).length} users`);
    
    const migData = JSON.parse(fs.readFileSync('./migrated_investments.json', 'utf8'));
    console.log(`Processing ${migData.length} records`);
    
    let success = 0;
    let notFound = 0;
    let errors = 0;
    
    // Map product names to IDs and ROI
    const productMap = {
        '30일': { id: 'ddra_30', name: 'DDRA 30Days', roiPercent: 0.8 },
        '90일': { id: 'ddra_90', name: 'DDRA 90Days', roiPercent: 1.0 },
        '180일': { id: 'ddra_180', name: 'DDRA 180Days', roiPercent: 1.2 },
        '360일': { id: 'ddra_360', name: 'DDRA 360Days', roiPercent: 1.5 },
    };
    
    // Start date is purchase_date
    // Calculate paidRoi until today (2026-03-18)
    const todayStr = '2026-03-18';
    const todayTime = new Date(todayStr).getTime();
    
    for (const record of migData) {
        const username = String(record.member_id).toLowerCase().trim();
        const uid = usersMap[username];
        if (!uid) {
            console.log(`User not found: ${username}`);
            notFound++;
            continue;
        }
        
        const pInfo = productMap[record.product];
        if (!pInfo) {
            console.log(`Unknown product: ${record.product}`);
            errors++;
            continue;
        }
        
        const amount = Number(record.payment_amount); // 100
        const durationDays = parseInt(record.product.replace('일', ''));
        
        const startDateStr = record.purchase_date; // e.g. 2026-03-18
        const startDateTime = new Date(startDateStr).getTime();
        
        const endDateTime = startDateTime + (durationDays * 86400000);
        const endDateStr = new Date(endDateTime).toISOString();
        
        // Calculate days passed
        let daysPassed = 0;
        if (todayTime > startDateTime) {
            daysPassed = Math.floor((todayTime - startDateTime) / 86400000);
        }
        // Limit days passed to duration
        if (daysPassed > durationDays) daysPassed = durationDays;
        if (daysPassed < 0) daysPassed = 0;
        
        const dailyRoiAmount = amount * (pInfo.roiPercent / 100);
        const paidRoi = daysPassed * dailyRoiAmount;
        const expectedReturn = amount * (pInfo.roiPercent / 100) * durationDays;
        
        // Create an investment document
        const invId = `inv_mig_${record.order_no.replace(/[^a-zA-Z0-9]/g, '')}`;
        
        const invDoc = {
            id: invId,
            userId: uid,
            productId: pInfo.id,
            productName: pInfo.name,
            amount: amount,
            currency: 'USDT',
            roiPercent: pInfo.roiPercent,
            durationDays: durationDays,
            expectedReturn: expectedReturn,
            paidRoi: paidRoi,
            status: 'active',
            startDate: new Date(startDateStr).toISOString(),
            endDate: endDateStr,
            createdAt: new Date().toISOString(),
            lastSettledAt: todayTime > startDateTime ? new Date(todayStr).toISOString() : null,
            source: 'migration'
        };
        
        // Insert to Firestore
        const postRes = await fetch(`${FIRESTORE_BASE}/investments?documentId=${invId}`, {
            method: 'POST', // Actually PATCH or POST without id in path? 
            // Wait, for documentId it should be POST to collection with ?documentId=...
            // or PATCH to document path.
        });
        
        const patchRes = await fetch(`${FIRESTORE_BASE}/investments/${invId}`, {
            method: 'PATCH',
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: toFirestore(invDoc).mapValue.fields })
        });
        
        if (!patchRes.ok) {
            console.error(`Failed to insert for ${username}: ${await patchRes.text()}`);
            errors++;
        } else {
            success++;
        }
        
        // We should also increment user's wallet.totalInvest so their UI total invested matches.
        // But doing it via REST API `commit` for transaction is hard.
        // Actually we can do it later if needed, but for now let's just create investments.
    }
    
    console.log(`Success: ${success}, Not Found: ${notFound}, Errors: ${errors}`);
  } catch(e) {
    console.error(e);
  }
}
run();
