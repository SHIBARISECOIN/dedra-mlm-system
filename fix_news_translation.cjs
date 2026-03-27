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
  
  // Update the first news item (Bitcoin mining difficulty)
  const updateUrl1 = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/news/6hM8L6NfQ2t6zXh0tLhP?updateMask.fieldPaths=title_en&updateMask.fieldPaths=summary_en";
  await fetch(updateUrl1, {
    method: 'PATCH', headers,
    body: JSON.stringify({
      fields: {
        title_en: { stringValue: "Bitcoin Mining Difficulty Drops by 7.7%... Pressure on Miners Continues" },
        summary_en: { stringValue: "Bitcoin mining difficulty has dropped significantly for the second time in 2026, slightly easing the burden on remaining mining companies. However, competition with AI data centers is intensifying." }
      }
    })
  });

  // Update the second news item (South Korea crypto tax)
  const updateUrl2 = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/news/7hM8L6NfQ2t6zXh0tLhQ?updateMask.fieldPaths=title_en&updateMask.fieldPaths=summary_en";
  await fetch(updateUrl2, {
    method: 'PATCH', headers,
    body: JSON.stringify({
      fields: {
        title_en: { stringValue: "South Korean Opposition Party Pushes for Abolition of Planned 22% Crypto Tax" },
        summary_en: { stringValue: "The ruling Democratic Party has stated that while there is no internal consensus yet on abolishing the tax, they are reviewing the proposal." }
      }
    })
  });

  // Update the third news item (Crypto fear & greed)
  const updateUrl3 = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/news/8hM8L6NfQ2t6zXh0tLhR?updateMask.fieldPaths=title_en&updateMask.fieldPaths=summary_en";
  await fetch(updateUrl3, {
    method: 'PATCH', headers,
    body: JSON.stringify({
      fields: {
        title_en: { stringValue: "Crypto Fear & Greed Index Rebounds... Signals of Investor Re-entry" },
        summary_en: { stringValue: "Investor sentiment is improving as the Crypto Fear & Greed Index escapes the extreme fear zone. Attention is focused on whether new capital inflows can trigger a bull market again." }
      }
    })
  });

  // Update the fourth news item (Bithumb penalty)
  const updateUrl4 = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents/news/9hM8L6NfQ2t6zXh0tLhS?updateMask.fieldPaths=title_en&updateMask.fieldPaths=summary_en";
  await fetch(updateUrl4, {
    method: 'PATCH', headers,
    body: JSON.stringify({
      fields: {
        title_en: { stringValue: "South Korea: Bithumb Fined $24 Million and Ordered Partial Business Suspension for 6 Months" },
        summary_en: { stringValue: "Regulatory authorities detected 6.65 million violations of Anti-Money Laundering (AML) regulations at Bithumb, which included 45,772 cryptocurrency transfers related to 18 unregistered foreign virtual asset operators." }
      }
    })
  });

  console.log("Updated news translations");
}
run().catch(console.error);
