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
  
  const updateUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/announcements/FTigVe3NgMtkVaFodgWI?updateMask.fieldPaths=title_en&updateMask.fieldPaths=content_en";

  const newTitleEn = "[Notice] DEEDRA Game Service Normalization and Usage Guide";
  const newContentEn = `<p><strong>[Notice] DEEDRA Game Service Normalization and Usage Guide</strong></p>
<p>Hello, this is the <strong>DEEDRA Operations Team</strong>.</p>
<p>We would like to inform you that the recent errors in our game service have been resolved.<br>
<strong>The game server logic inspection and odds balance patch have been successfully completed, and the service is now normalized.</strong></p>
<p>However, for some members, outdated <strong>cache (temporary data)</strong> remaining in the browser might prevent the latest game updates from taking effect immediately.</p>
<p>In this situation, even if you successfully connect to the game,<br>
<strong>the game results may be displayed inaccurately, bets and progress might not be processed correctly, or the game may appear to proceed without functioning properly.</strong></p>
<p>Therefore, if you have recently experienced any errors or issues with placing bets, please make sure to follow the steps below before playing.</p>
<h3>Required Measures for Normal Gameplay</h3>
<ol>
<li>
<strong>Completely close all open tabs</strong> in your browser (Safari, Chrome, etc.).
</li>
<li>
<strong>Reconnect</strong> to the DEEDRA service.
</li>
<li>
If the issue persists, <strong>clear your browser's internet cache and history, then reconnect</strong>.
</li>
</ol>
<p><strong>If you continue playing the game without taking these steps, your results may not be accurately reflected. You might encounter situations where the game appears to be running, but no actual processing occurs. Please ensure you reconnect before playing.</strong></p>
<p>DEEDRA is continuously inspecting and optimizing our systems to provide a more stable and accurate service environment.</p>
<p>We sincerely apologize for any inconvenience this may have caused, and we will continue to do our best to provide a more reliable service in the future.</p>
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
  console.log(uData);
}
run().catch(console.error);
