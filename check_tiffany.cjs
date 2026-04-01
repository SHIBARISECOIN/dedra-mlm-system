const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkTiff() {
    const tiffId = 'rlSK0MotrUT1AbEXlSAmolfKpZ42'; // tiffany01@deedra.com
    
    const countDocs = async (collection, conditions) => {
        let q = db.collection(collection);
        for(let cond of conditions) q = q.where(cond[0], cond[1], cond[2]);
        const snap = await q.get();
        return snap.size;
    };

    const dates = ['2026-03-29', '2026-03-30', '2026-03-31'];
    
    console.log("tiffany01@deedra.com (G10) Rank Bonus Details");
    for (const d of dates) {
        const snap = await db.collection('bonuses')
            .where('userId', '==', tiffId)
            .where('type', '==', 'rank_bonus')
            .where('settlementDate', '==', d)
            .get();
            
        let totalAmt = 0;
        let reasons = {};
        snap.forEach(doc => {
            totalAmt += doc.data().amountUsdt || 0;
            const r = doc.data().reason || 'unknown';
            reasons[r] = (reasons[r] || 0) + 1;
        });
        
        console.log(`[${d}] Count: ${snap.size}, Total: $${totalAmt.toFixed(2)}`);
        // console.log(reasons);
    }
    
    process.exit(0);
}
checkTiff().catch(console.error);
