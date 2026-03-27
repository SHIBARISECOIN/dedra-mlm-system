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
  
  let bacGames = [];
  games.forEach(doc => {
      const d = doc.data();
      // DB에는 'game' 필드에 '바카라'라고 저장되어 있었음 (이전 로그 확인 결과)
      if (d.game === '바카라') {
          bacGames.push(d);
      }
  });
  
  console.log(`Total Baccarat games found: ${bacGames.length}`);
  
  let winLogs = bacGames.filter(d => d.win === true);
  console.log(`Baccarat wins: ${winLogs.length}`);
  
  // Sort by win amount
  winLogs.sort((a,b) => (b.usdtChange || 0) - (a.usdtChange || 0));
  
  console.log("\nTop 10 Baccarat Wins (showing Tie probability):");
  winLogs.slice(0, 10).forEach(d => {
      // In Baccarat, if ratio of change to bet is high (usually 8:1 for Tie)
      const ratio = d.usdtChange / d.betUsdt;
      console.log(`[${d.createdAt?.toDate?.()}] Bet: ${d.betUsdt}, Win: ${d.usdtChange}, Ratio: ${ratio.toFixed(2)}`);
  });
}

check().then(() => process.exit(0)).catch(console.error);
