const fs = require('fs');
const { google } = require('googleapis');

const saContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const clientEmail = saContent.match(/client_email:\s*"([^"]+)"/)[1];
const privateKeyStr = saContent.match(/private_key:\s*"([^"]+)"/)[1];
const privateKey = privateKeyStr.replace(/\\n/g, '\n');
const projectId = saContent.match(/project_id:\s*"([^"]+)"/)[1];

console.log("Got key details:", !!clientEmail, !!privateKey);

async function deployRules() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform']
  });
  
  const client = await auth.getClient();
  
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
    auth: client
  });
  
  const rulesetName = res.data.name;
  console.log('Created ruleset:', rulesetName);
  
  await google.firebaserules('v1').projects.releases.update({
    name: `projects/${projectId}/releases/cloud.firestore`,
    requestBody: {
      rulesetName,
      name: `projects/${projectId}/releases/cloud.firestore`
    },
    auth: client
  });
  
  console.log('Rules deployed successfully');
}

deployRules().catch(console.error);
