const admin = require('firebase-admin');
const fs = require('fs');
const XLSX = require('xlsx');

const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const pIdMatch = idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/);
const cEmMatch = idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/);
const pKMatch = idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/);

if (pIdMatch && cEmMatch && pKMatch) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: pIdMatch[1],
      clientEmail: cEmMatch[1],
      privateKey: pKMatch[1].replace(/\\n/g, '\n')
    })
  });
} else {
  // Try check_user_cyj.cjs method
  const saContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
  const cEm = saContent.match(/client_email:\s*"([^"]+)"/)?.[1];
  const pK = saContent.match(/private_key:\s*"([^"]+)"/)?.[1].replace(/\\n/g, '\n');
  const pId = saContent.match(/project_id:\s*"([^"]+)"/)?.[1];
  if(cEm && pK && pId) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
  }
}
const db = admin.firestore();

async function run() {
  const wb = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Excel data loaded: ${data.length} records.`);
  // Analyze mismatches logic goes here
  console.log("Ready to process...");
}
run().then(() => process.exit(0)).catch(console.error);
