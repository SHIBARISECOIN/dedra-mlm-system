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
    
    // 1. Get Rates
    const ratesRes = await fetch(`${baseUrl}/settings/rates`, { headers: { Authorization: `Bearer ${token}` }});
    const rates = await ratesRes.json();
    console.log("=== 시스템 설정 (RATES) ===");
    console.log(JSON.stringify(rates.fields, null, 2));

    // 2. Count Users (Estimate by fetching a few and checking if we can)
    // Actually, we can run a structured query to count, but let's just fetch latest 1 to see structure
    const usersRes = await fetch(`${baseUrl}/users?pageSize=1&orderBy=createdAt%20desc`, { headers: { Authorization: `Bearer ${token}` }});
    const users = await usersRes.json();
    console.log("\n=== 최신 가입 회원 샘플 ===");
    if(users.documents && users.documents.length > 0) {
      console.log(users.documents[0].fields.username?.stringValue, " / Rank:", users.documents[0].fields.rank?.stringValue);
    }

    // 3. Get Announcements
    const annRes = await fetch(`${baseUrl}/announcements?pageSize=3`, { headers: { Authorization: `Bearer ${token}` }});
    const anns = await annRes.json();
    console.log("\n=== 최근 공지사항 ===");
    if(anns.documents) {
      anns.documents.forEach(d => console.log("-", d.fields.title?.stringValue));
    }

  } catch(e) {
    console.error(e);
  }
}
run();
