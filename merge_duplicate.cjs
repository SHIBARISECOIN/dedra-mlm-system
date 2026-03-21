const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); }
const db = admin.firestore();

async function run() {
    const leftUid = 'Fwuwmh5zdxYIz3HQX1bwihG9vc13'; // pb9824@deedra.com (Older)
    const rightUid = '1erxqe9iHrQO6xI1HUnzM0t34xW2'; // pb9824@naver.com (Newer)

    console.log("1. Moving downlines from right to left...");
    const downlinesSnap = await db.collection('users').where('referredBy', '==', rightUid).get();
    
    let count = 0;
    const batch = db.batch();
    
    downlinesSnap.forEach(doc => {
        console.log(`   - Moving downline: ${doc.data().name} (${doc.data().email}) to ${leftUid}`);
        batch.update(doc.ref, { referredBy: leftUid });
        count++;
    });
    
    if (count > 0) {
        await batch.commit();
        console.log(`   -> Moved ${count} downlines successfully.`);
    } else {
        console.log(`   -> No downlines to move.`);
    }

    console.log("\n2. Deleting the right user (duplicate with no downlines now)...");
    await db.collection('users').doc(rightUid).delete();
    await db.collection('wallets').doc(rightUid).delete();
    
    // Auth deletion (if it exists)
    try {
        await admin.auth().deleteUser(rightUid);
        console.log(`   -> Deleted from Firebase Auth.`);
    } catch(e) {
        console.log(`   -> Firebase Auth delete skipped or user not found (${e.code}).`);
    }

    console.log("   -> Deleted user document and wallet.");
    console.log("\n=== Done ===");
}

run().catch(console.error);
