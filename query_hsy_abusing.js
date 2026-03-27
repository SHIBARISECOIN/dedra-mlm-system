import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02'; // hsy7948's UID
  
  console.log("=== USER WALLET INFO ===");
  const wallet = await db.collection('wallets').doc(uid).get();
  console.log(wallet.data());
  
  console.log("\n=== TRANSACTIONS ===");
  const txs = await db.collection('transactions').where('userId', '==', uid).get();
  let txArr = [];
  txs.forEach(doc => txArr.push(doc.data()));
  txArr.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  txArr.slice(0,20).forEach(d => {
      console.log(`[${d.createdAt?.toDate?.()}] Type: ${d.type}, Amount: ${d.amount}, Status: ${d.status}`);
  });

  console.log("\n=== GAME LOGS ===");
  const games = await db.collection('game_logs').where('userId', '==', uid).get();
  let gameArr = [];
  games.forEach(doc => gameArr.push(doc.data()));
  gameArr.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  gameArr.slice(0,20).forEach(d => {
      console.log(`[${d.createdAt?.toDate?.()}] Game: ${d.gameName}, Bet: ${d.betAmount}, Win: ${d.winAmount}, Payout: ${d.payout}`);
  });
  
  console.log("\n=== INVESTMENTS ===");
  const invs = await db.collection('investments').where('userId', '==', uid).get();
  invs.forEach(doc => {
      const d = doc.data();
      console.log(`[${d.createdAt?.toDate?.()}] Amount: ${d.amount}, Status: ${d.status}`);
  });
}

check().then(() => process.exit(0)).catch(console.error);
