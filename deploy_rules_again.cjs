const admin = require('firebase-admin');
const fs = require('fs');
const { google } = require('googleapis');

async function deployRules() {
  try {
    const key = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
    const jwtClient = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform']
    );
    await jwtClient.authorize();
    
    const projectId = key.project_id;
    const rulesUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
    const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`;
    
    const rulesContent = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');
    
    // Create ruleset
    console.log('Creating ruleset...');
    const createRes = await fetch(rulesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtClient.credentials.access_token}`,
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
    console.log('Ruleset created:', ruleset.name);
    
    // Update release
    console.log('Updating release...');
    const releaseRes = await fetch(releaseUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${jwtClient.credentials.access_token}`,
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
deployRules();
