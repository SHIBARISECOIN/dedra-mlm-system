const admin = require('firebase-admin');
const fs = require('fs');

const saContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const clientEmail = saContent.match(/client_email:\s*"([^"]+)"/)[1];
const privateKey = saContent.match(/private_key:\s*"([^"]+)"/)[1].replace(/\\n/g, '\n');
const projectId = saContent.match(/project_id:\s*"([^"]+)"/)[1];

const { google } = require('googleapis');

async function deployRules() {
  const auth = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform']
  );
  
  await auth.authorize();
  
  const rulesContent = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');
  
  const res = await google.firebaserules('v1').projects.rulesets.create({
    name: `projects/${projectId}`,
    requestBody: {
      source: {
        files: [
          {
            content: rulesContent,
            name: 'firestore.rules'
          }
        ]
      }
    },
    auth
  });
  
  const rulesetName = res.data.name;
  console.log('Created ruleset:', rulesetName);
  
  await google.firebaserules('v1').projects.releases.update({
    name: `projects/${projectId}/releases/cloud.firestore`,
    requestBody: {
      rulesetName,
      name: `projects/${projectId}/releases/cloud.firestore`
    },
    auth
  });
  
  console.log('Rules deployed successfully');
}

deployRules().catch(console.error);
