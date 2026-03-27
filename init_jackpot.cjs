const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const fs = require('fs');
const fetch = require('node-fetch');

async function run() {
  // 1. Create document
  await db.collection('events').doc('jackpot').set({
      active: false,
      amount: 20000,
      durationHours: 24,
      endTime: Date.now() + 24*3600*1000,
      lastInvestorUid: null,
      lastInvestorName: '아직 없음'
  }, { merge: true });
  console.log("Jackpot document initialized.");

  // 2. Update firestore.rules
  let rules = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');
  if (!rules.includes('match /events/')) {
      rules = rules.replace(/match \/users\/\{userId\}/, `match /events/{docId} {
      allow read: if isLoggedIn();
      allow write: if isLoggedIn();
    }

    match /users/{userId}`);
      fs.writeFileSync('/home/user/webapp/firestore.rules', rules);
      console.log("firestore.rules updated locally.");
      
      // Deploy rules
      const client = await admin.app().options.credential.getAccessToken();
      const token = client.access_token;
      const projectId = serviceAccount.project_id;
      
      const rulesetBody = { source: { files: [{ name: "firestore.rules", content: rules }] } };
      const createRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesetBody)
      });
      const createData = await createRes.json();
      if(createData.name) {
          await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, {
            method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: createData.name } })
          });
          console.log("Rules deployed to Firebase.");
      }
  } else {
      console.log("Rules already contain /events/");
  }
}
run().catch(console.error).finally(() => process.exit(0));
