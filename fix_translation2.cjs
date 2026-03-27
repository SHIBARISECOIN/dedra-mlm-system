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
  
  const updateUrl = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/announcements/ugmSCoKgKFhonv6N2vuP?updateMask.fieldPaths=title_en&updateMask.fieldPaths=content_en";

  const newTitleEn = "[Notice] Guide to Registering Your Personal Wallet for Faster Deposit Verification";
  const newContentEn = `<h2>[Notice] Guide to Registering Your Personal Wallet for Faster Deposit Verification</h2>
<p>Hello.<br>
We are sharing this important notice with our members to ensure faster and more accurate verification of your deposits.</p>
<p>Currently, the <strong>MOA tab</strong> includes a feature that allows you to register your personal wallet address.<br>
If you <strong>register your personal wallet through this feature before making a deposit</strong>, the system can verify and process your deposit details much more quickly.</p>
<p>This is especially important when there is a high volume of deposits. Because verifications are processed based on registered wallet information,<br>
<strong>having your wallet pre-registered significantly speeds up the deposit confirmation process.</strong></p>
<p>Therefore, for a smoother experience, we strongly recommend that all members follow the steps below.</p>
<h3>Usage Guide</h3>
<ol>
<li>
<strong>First, register your personal wallet in the MOA tab.</strong>
</li>
<li>
<strong>Proceed to make your deposit using your registered wallet.</strong>
</li>
<li>
Your deposit will be confirmed much faster based on the registered information.
</li>
</ol>
<p>While deposits made without a registered wallet can still be verified,<br>
the verification and processing time will be longer compared to using a pre-registered wallet.</p>
<p>For a faster and more convenient experience,<br>
please <strong>ensure you register your wallet in the MOA tab before making a deposit.</strong></p>
<p>Thank you.</p>`;

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
  console.log("Updated second notice:", uData.name);
}
run().catch(console.error);
