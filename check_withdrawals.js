import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';

const html = readFileSync('./public/static/admin.html', 'utf8');
const firebaseConfigStr = html.match(/const firebaseConfig = ({[\s\S]*?});/)[1];
const firebaseConfig = eval('(' + firebaseConfigStr + ')');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const q = query(collection(db, 'transactions'), where('type', '==', 'withdrawal'));
  const snap = await getDocs(q);
  const now = Date.now();
  console.log(`Total withdrawal docs: ${snap.size}`);
  snap.forEach(d => {
    const data = d.data();
    const time = data.createdAt ? data.createdAt.seconds * 1000 : 0;
    // only show today's
    if (now - time < 86400000 * 2) {
      console.log(`ID: ${d.id}, status: ${data.status}, amount: ${data.amount}, amountUsdt: ${data.amountUsdt}, time: ${new Date(time).toLocaleString()}`);
    }
  });
  process.exit(0);
}
check();
