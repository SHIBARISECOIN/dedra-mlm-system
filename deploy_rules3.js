const fs = require('fs');
const { google } = require('googleapis');

const saContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const clientEmail = saContent.match(/client_email:\s*"([^"]+)"/)[1];
const privateKeyStr = saContent.match(/private_key:\s*"([^"]+)"/)[1];
const privateKey = privateKeyStr.replace(/\\n/g, '\n');
const projectId = saContent.match(/project_id:\s*"([^"]+)"/)[1];

async function deployRules() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform']
  });
  
  const client = await auth.getClient();
  
  const rulesetName = 'projects/dedra-mlm/rulesets/de045f3b-e6c2-4ce7-b45b-dea7bc343ea7';
  
  await google.firebaserules('v1').projects.releases.patch({
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
