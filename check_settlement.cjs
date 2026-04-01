const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkSettle() {
    const todayStr = '2026-03-31'; // 어제
    
    const countDocs = async (collection, conditions) => {
        let q = db.collection(collection);
        for(let cond of conditions) q = q.where(cond[0], cond[1], cond[2]);
        const snap = await q.get();
        return snap.size;
    };

    const roi31 = await countDocs('bonuses', [['type','==','roi'], ['settlementDate','==','2026-03-31']]);
    const rank31 = await countDocs('bonuses', [['type','==','rank_bonus'], ['settlementDate','==','2026-03-31']]);
    const match31 = await countDocs('bonuses', [['type','==','rank_matching'], ['settlementDate','==','2026-03-31']]);

    const roi30 = await countDocs('bonuses', [['type','==','roi'], ['settlementDate','==','2026-03-30']]);
    const rank30 = await countDocs('bonuses', [['type','==','rank_bonus'], ['settlementDate','==','2026-03-30']]);
    const match30 = await countDocs('bonuses', [['type','==','rank_matching'], ['settlementDate','==','2026-03-30']]);

    console.log("=== Settlement Stats ===");
    console.log(`[3/30] ROI: ${roi30}, Rank: ${rank30}, Matching: ${match30}`);
    console.log(`[3/31] ROI: ${roi31}, Rank: ${rank31}, Matching: ${match31}`);

    process.exit(0);
}
checkSettle().catch(console.error);
