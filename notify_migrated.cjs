const fs = require('fs');
const crypto = require('crypto');

// Extract SERVICE_ACCOUNT from index.tsx
const indexCode = fs.readFileSync('./src/index.tsx', 'utf8');
const saMatch = indexCode.match(/const SERVICE_ACCOUNT = ({[\s\S]*?\n})/);
let saCode = saMatch[1];
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
    
    // 1. Fetch users to map username -> uid
    console.log("Fetching users...");
    const resUsers = await fetch(`${FIRESTORE_BASE}/users?pageSize=1000`, {
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
    
    // 2. Read migrated data and group by user
    const migData = JSON.parse(fs.readFileSync('./migrated_investments.json', 'utf8'));
    const userProducts = {};
    
    for (const record of migData) {
        const username = String(record.member_id).toLowerCase().trim();
        const uid = usersMap[username];
        if (!uid) continue;
        
        if (!userProducts[uid]) userProducts[uid] = {};
        const prod = record.product;
        if (!userProducts[uid][prod]) userProducts[uid][prod] = { count: 0, amount: 0 };
        
        userProducts[uid][prod].count++;
        userProducts[uid][prod].amount += Number(record.payment_amount);
    }
    
    const uidsToNotify = Object.keys(userProducts);
    console.log(`Sending notifications to ${uidsToNotify.length} users...`);
    
    // 3. Create notifications
    let success = 0;
    let errors = 0;
    
    for (const uid of uidsToNotify) {
        const prods = userProducts[uid];
        let bodyLines = ['이전 사이트의 보유 상품이 성공적으로 이전되었습니다. 📦\n'];
        let totalCount = 0;
        let totalAmount = 0;
        
        for (const [prodName, stats] of Object.entries(prods)) {
            bodyLines.push(`- ${prodName} 패키지: ${stats.count}개 (${stats.amount} USDT)`);
            totalCount += stats.count;
            totalAmount += stats.amount;
        }
        
        bodyLines.push(`\n총 ${totalCount}개의 상품(${totalAmount} USDT)이 정상 연동되어, 하단 [FREEZE] 탭에서 확인 및 일일 수익이 정상 지급됩니다.`);
        
        const body = bodyLines.join('\n');
        
        const notifDoc = {
            userId: uid,
            title: '📦 기존 상품 연동 완료 안내',
            body: body,
            type: 'system',
            isRead: false,
            createdAt: new Date().toISOString()
        };
        
        const notifId = `mig_notif_${uid}`;
        
        const patchRes = await fetch(`${FIRESTORE_BASE}/notifications/${notifId}`, {
            method: 'PATCH',
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: toFirestore(notifDoc).mapValue.fields })
        });
        
        if (!patchRes.ok) {
            console.error(`Failed to send notification for ${uid}: ${await patchRes.text()}`);
            errors++;
        } else {
            success++;
        }
    }
    
    console.log(`Done! Success: ${success}, Errors: ${errors}`);
    
  } catch(e) {
    console.error(e);
  }
}
run();
