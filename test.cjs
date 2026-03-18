const admin = require('firebase-admin');
const fs = require('fs');

const idxContent = fs.readFileSync('./src/index.tsx', 'utf8');

const pIdMatch = idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/);
const cEmMatch = idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/);
const pKMatch = idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/);

if (!pIdMatch || !cEmMatch || !pKMatch) {
  console.log("Could not parse credentials");
  process.exit(1);
}

const projectId = pIdMatch[1];
const clientEmail = cEmMatch[1];
const privateKey = pKMatch[1].replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey
  })
});

admin.firestore().collection('wallets').limit(1).get().then(s => {
  console.log(s.docs[0].id, s.docs[0].data());
  process.exit(0);
});
