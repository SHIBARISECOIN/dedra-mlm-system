import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02'; // hsy7948
  
  // collection name is 'gamelogs' (no underscore)
  const games = await db.collection('gamelogs').where('userId', '==', uid).get();
  console.log(`Found ${games.size} logs in 'gamelogs' collection for this user`);
  games.forEach(doc => {
      const d = doc.data();
      console.log(`[${d.createdAt?.toDate?.()}] Game: ${d.gameName}, Bet: ${d.betAmount}, Win: ${d.winAmount}, Change: ${d.actualDdraChange}`);
  });
}

check().then(() => process.exit(0)).catch(console.error);
