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
  
  const games = await db.collection('gamelogs').where('userId', '==', uid).get();
  let records = [];
  games.forEach(doc => records.push(doc.data()));
  
  // Sort by date desc
  records.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  
  console.log(`Total games played: ${records.length}`);
  
  // Print the first 10 with full details
  records.slice(0, 10).forEach(d => {
      console.log(`[${d.createdAt?.toDate?.()}]`, JSON.stringify(d));
  });
  
  // Calculate total win/loss
  let totalBet = 0;
  let totalWin = 0;
  let totalChange = 0;
  
  records.forEach(d => {
      totalBet += Number(d.bet || d.betAmount || 0);
      totalWin += Number(d.win || d.winAmount || 0);
      totalChange += Number(d.actualChange || d.actualDdraChange || d.change || 0);
  });
  
  console.log(`\nStats: Total Bet=${totalBet}, Total Win=${totalWin}, Total Change=${totalChange}`);
}

check().then(() => process.exit(0)).catch(console.error);
