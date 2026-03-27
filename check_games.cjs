const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function checkGames() {
  const uid = 'KM7pKoYx4lM2gUt1wKPgT2rl57M2';
  const snapshot = await db.collection('game_logs').where('userId', '==', uid).get();
  
  let txs = [];
  snapshot.forEach(doc => {
    let tx = doc.data();
    txs.push({
      game: tx.gameId,
      amount: tx.betAmount,
      winAmount: tx.winAmount,
      date: tx.createdAt ? tx.createdAt.toDate().toISOString() : 'N/A'
    });
  });
  
  if(txs.length) console.table(txs);
  else console.log('No game logs');
  process.exit(0);
}
checkGames().catch(console.error);
