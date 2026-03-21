import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  // Why did it process 0? Ah, lastSettledAt is in UTC. The investments are not due.
  // Wait, in do_rollback_manual.js I set: lastSettledAt: "2026-03-20T19:00:00.000Z"
  // Which is "today". Settlement script checks: difference > 24 hours.
  // Ah! Because today's date for the server is 2026-03-20. 
  // We need to set lastSettledAt to "2026-03-19T23:59:59.000Z" to make them eligible again!
  const targetDate = '2026-03-21';
  console.log(`Starting clean rollback for ${targetDate}`);
  
  // We don't have to rollback again, we just need to update the investments that were rolled back previously!
  // BUT the settlement doc for '2026-03-21' was created, we need to delete it.
  await db.collection('settlements').doc('2026-03-21').delete();
  
  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  const invPromises = [];
  invSnap.forEach(doc => {
    const inv = doc.data();
    if (inv.lastSettledAt && inv.lastSettledAt.startsWith('2026-03-20T19:00')) {
      invPromises.push(doc.ref.update({ lastSettledAt: "2026-03-19T23:59:59.000Z" }));
    }
  });
  
  console.log(`Updating ${invPromises.length} investments to be eligible for settlement...`);
  for (let i = 0; i < invPromises.length; i += 50) await Promise.all(invPromises.slice(i, i + 50));
  
  // Actually wait, let's just make ALL active investments that have lastSettledAt > '2026-03-20T00' back to 19th IF they haven't been processed.
  // wait, the previous ones that I rolled back BEFORE this (for 20th) were set to 19th already!
  // So why did the settlement script skip them?!
  // Let's check the settlement script logic for date check.
}

run();
