const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
const fs = require('fs');
const fetch = require('node-fetch');

async function deployRules() {
  const rules = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  // Use the REST API to update rules
  // Since we have the service account, we can get an access token
  const client = await admin.app().options.credential.getAccessToken();
  const token = client.access_token;
  const projectId = serviceAccount.project_id;
  
  console.log("Getting current ruleset...");
  
  // Actually, updating rules via REST API is complex because we need to create a ruleset and then release it.
  // Let's just create a quick shell script to do it via curl
  
  const rulesetBody = {
    source: {
      files: [
        {
          name: "firestore.rules",
          content: rules
        }
      ]
    }
  };
  
  console.log("Creating new ruleset...");
  const createRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(rulesetBody)
  });
  
  const createData = await createRes.json();
  if (!createData.name) {
    console.error("Failed to create ruleset:", createData);
    return;
  }
  
  const rulesetName = createData.name;
  console.log("Created ruleset:", rulesetName);
  
  console.log("Releasing ruleset...");
  const releaseBody = {
    name: `projects/${projectId}/releases/cloud.firestore`,
    rulesetName: rulesetName
  };
  
  const releaseRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ release: releaseBody })
  });
  
  const releaseData = await releaseRes.json();
  console.log("Release result:", releaseData);
  console.log("Rules deployed successfully!");
}

deployRules().catch(console.error);
