const admin = require('firebase-admin');
const fs = require('fs');

async function deployRules() {
  try {
    const key = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
    
    // get access token manually using native fetch to avoid googleapis dependency issues
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: createJwt(key)
      })
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    }
    
    const projectId = key.project_id;
    const rulesUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
    const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`;
    
    const rulesContent = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');
    
    // Create ruleset
    console.log('Creating ruleset...');
    const createRes = await fetch(rulesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: {
          files: [{
            name: 'firestore.rules',
            content: rulesContent
          }]
        }
      })
    });
    
    const ruleset = await createRes.json();
    if (!ruleset.name) {
      throw new Error('Failed to create ruleset: ' + JSON.stringify(ruleset));
    }
    console.log('Ruleset created:', ruleset.name);
    
    // Update release
    console.log('Updating release...');
    const releaseRes = await fetch(releaseUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        release: {
          name: `projects/${projectId}/releases/cloud.firestore`,
          rulesetName: ruleset.name
        }
      })
    });
    
    const release = await releaseRes.json();
    console.log('Release updated successfully!');
  } catch (e) {
    console.error('Error:', e);
  }
}

function createJwt(key) {
  const crypto = require('crypto');
  const header = { alg: 'RS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat
  };
  
  const encodeBase64Url = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };
  
  const encodedHeader = encodeBase64Url(header);
  const encodedPayload = encodeBase64Url(payload);
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(key.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${signatureInput}.${signature}`;
}

deployRules();
