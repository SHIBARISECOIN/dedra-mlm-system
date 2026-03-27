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
  
  const games = await db.collection('gamelogs')
    .where('userId', '==', uid)
    .where('gameName', '==', '바카라')
    .get();
    
  let tieBets = 0;
  let tieWins = 0;
  let totalBac = 0;
  
  games.forEach(doc => {
      totalBac++;
      const d = doc.data();
      // Look at the details if possible, or just look at win amounts vs bet amounts
      // In Baccarat, Tie usually pays 8:1. So winAmount == betAmount * 8 or 9.
      if (d.winAmount >= d.betAmount * 5) {
          tieWins++;
      }
      // Or check if memo/description contains 'tie' (depends on schema)
  });
  
  console.log(`Total Baccarat games: ${totalBac}`);
  console.log(`Potential Tie wins (high payout): ${tieWins}`);
  
  // Let's grab some specific baccarat win logs to see the ratio
  let winLogs = [];
  games.forEach(doc => {
      const d = doc.data();
      if (d.winAmount > 0) winLogs.push(d);
  });
  
  winLogs.sort((a,b) => b.winAmount - a.winAmount);
  console.log("\nTop 5 Baccarat Wins:");
  winLogs.slice(0, 5).forEach(d => {
      console.log(`Bet: ${d.betAmount}, Win: ${d.winAmount}, Ratio: ${d.winAmount/d.betAmount}`);
  });
}

check().then(() => process.exit(0)).catch(console.error);
