const fs = require('fs');
async function run() {
  const code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
  const saMatch = code.match(/const\s+SERVICE_ACCOUNT\s*=\s*(\{[\s\S]+?\n\})/);
  let saString = saMatch[1];
  const sa = new Function('return (' + saString + ');')();
  
  const crypto = require('crypto');
  function createJwt() {
    const header = { alg: 'RS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = {
      iss: sa.client_email, sub: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat, exp, scope: 'https://www.googleapis.com/auth/datastore'
    };
    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(b64Header + '.' + b64Payload);
    return b64Header + '.' + b64Payload + '.' + sign.sign(sa.private_key, 'base64url');
  }
  
  const jwt = createJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const tData = await res.json();
  const token = tData.access_token;
  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  
  const updateUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/announcements/ZMZjCKZnkLRjdVpQWOG9?updateMask.fieldPaths=title_en&updateMask.fieldPaths=content_en";

  const newTitleEn = "[Notice] Guide to DEEDRA Official Telegram Channels";
  const newContentEn = `<h1>[Notice] Guide to DEEDRA Official Telegram Channels</h1>
<p>Hello, this is the <strong>DEEDRA Operations Team</strong>.</p>
<p>To ensure faster and smoother communication with our members,<br>we have organized our <strong>official DEEDRA Telegram channels</strong> as follows:</p>

<h2>1. DEEDRA Official Announcements Telegram</h2>
<p>This is the <strong>official announcement channel</strong> where we share essential information,<br>including major service announcements, operational updates, and new features.</p>
<p>👉 <a rel="noopener" target="_new" href="https://t.me/+gKmpRB1RNhU5Y2Jl">Go to DEEDRA Official Announcements Telegram</a></p>

<h2>2. DEEDRA Official Customer Support Center</h2>
<p>This is the <strong>official customer support (AS) center</strong> dedicated to assisting you with various issues encountered during service use,<br>such as connection errors, processing issues, account verification, and functional abnormalities.</p>
<p>👉 <a rel="noopener" target="_new" href="https://t.me/c/3629357896/1">Go to DEEDRA Official Customer Support Center</a></p>

<p>We kindly request all members to <strong>use the appropriate Telegram channel for your specific needs</strong>.</p>
<p>DEEDRA will continue to do its best to provide prompt, accurate guidance, and reliable service.</p>
<p>Thank you.</p>
<p><strong>DEEDRA Operations Team</strong></p>`;

  let uRes = await fetch(updateUrl, {
    method: 'PATCH', headers,
    body: JSON.stringify({
      fields: {
        title_en: { stringValue: newTitleEn },
        content_en: { stringValue: newContentEn }
      }
    })
  });
  let uData = await uRes.json();
  console.log("Updated third notice:", uData.name);
}
run().catch(console.error);
