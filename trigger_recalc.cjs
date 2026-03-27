const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Fetching via REST from backend API instead of script
const fetch = require('node-fetch');

async function run() {
  console.log("Calling backend sync-tree-sales API...");
  try {
    const res = await fetch('http://localhost:3000/api/admin/sync-tree-sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ secret: 'deedra-cron-2026' })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log("Success!", data);
    } else {
      console.log("Error status:", res.status);
    }
  } catch(e) {
    console.log("Fetch error:", e.message);
  }
}

run().then(() => process.exit(0)).catch(console.error);
