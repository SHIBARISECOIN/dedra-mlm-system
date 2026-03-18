const admin = require('firebase-admin');
const fs = require('fs');
const XLSX = require('xlsx');

// 1. Initialize Firebase
const saContent = fs.readFileSync('/home/user/webapp/sa.js', 'utf8').replace('const SERVICE_ACCOUNT = ', '').replace(/};\s*$/, '}');
const SERVICE_ACCOUNT = eval('(' + saContent + ')');
admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
const db = admin.firestore();

async function run() {
  console.log("Reading Excel file...");
  const workbook = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  // Map username -> earliest purchase date & max rate
  const excelMap = {};
  data.forEach(r => {
    if (!r.member_id) return;
    const uidStr = String(r.member_id).toLowerCase().trim();
    const pDate = String(r.purchase_date).trim();
    let rateStr = String(r.interest_rate || '0.8%').replace('%', '').trim();
    let rate = parseFloat(rateStr);
    
    if (!excelMap[uidStr] || new Date(pDate) < new Date(excelMap[uidStr].purchase_date)) {
      excelMap[uidStr] = {
        purchase_date: pDate,
        rate: rate
      };
    }
  });

  console.log(`Parsed ${Object.keys(excelMap).length} users from Excel.`);

  // 2. Fetch Users
  console.log("Fetching users...");
  const usersSnap = await db.collection('users').get();
  const usernameToUid = {};
  const uidToUser = {};
  usersSnap.forEach(d => {
    const u = d.data();
    uidToUser[d.id] = u;
    if (u.id) usernameToUid[u.id.toLowerCase()] = d.id;
    if (u.username) usernameToUid[u.username.toLowerCase()] = d.id;
  });

  // 3. Fetch Active Investments
  console.log("Fetching active investments...");
  const invsSnap = await db.collection('investments').where('status', '==', 'active').get();
  
  const todayStr = '2026-03-18'; // Set exactly as today's logic baseline
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();

  let totalUpdated = 0;

  for (const doc of invsSnap.docs) {
    const inv = doc.data();
    const uid = inv.userId;
    const user = uidToUser[uid];
    if (!user) continue;

    const username = (user.id || user.username || '').toLowerCase();
    const excelInfo = excelMap[username];
    if (!excelInfo) continue;

    const pDateStr = excelInfo.purchase_date; // e.g. "2026-03-07"
    const pDateMs = new Date(`${pDateStr}T00:00:00Z`).getTime();
    
    if (isNaN(pDateMs)) continue;
    
    // Calculate days missed
    const daysMissed = Math.floor((todayMs - pDateMs) / 86400000);
    
    // Only process if days missed > 0 AND it hasn't been fixed yet
    // We can check if it hasn't been fixed by checking if createdAt > pDateMs + 1 day
    const invCreatedMs = inv.createdAt ? inv.createdAt.toDate().getTime() : 0;
    
    // If the investment was created recently (e.g. they restored it yesterday or today)
    // and it missed its original start date.
    if (daysMissed > 0 && invCreatedMs > pDateMs + 86400000) {
      console.log(`Processing user: ${username} (UID: ${uid}) | Missed: ${daysMissed} days`);
      
      const principal = inv.amount || inv.amountUsdt || 0;
      const ratePct = excelInfo.rate; // e.g. 0.8
      const dailyRoi = principal * (ratePct / 100);
      const missedInterest = dailyRoi * daysMissed;
      
      console.log(` - Inv ID: ${doc.id}, Principal: $${principal}, Daily ROI: $${dailyRoi}, Total Missed: $${missedInterest}`);
      
      // Update the DB in a batch
      const batch = db.batch();
      
      // 1. Update Investment createdAt and earned
      batch.update(doc.ref, {
        createdAt: admin.firestore.Timestamp.fromDate(new Date(`${pDateStr}T00:00:00Z`)),
        roiPercent: ratePct,
        dailyRoi: ratePct,
        earned: admin.firestore.FieldValue.increment(missedInterest)
      });
      
      // 2. Update Wallet (add to bonusBalance & totalEarnings)
      const walletRef = db.collection('wallets').doc(uid);
      batch.update(walletRef, {
        bonusBalance: admin.firestore.FieldValue.increment(missedInterest),
        totalEarnings: admin.firestore.FieldValue.increment(missedInterest),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 3. Add to User (totalRevenue, though maybe wallet totalEarnings is enough, let's do both if exists)
      const userRef = db.collection('users').doc(uid);
      batch.update(userRef, {
        totalRevenue: admin.firestore.FieldValue.increment(missedInterest)
      });
      
      // 4. Create missed bonuses records
      for (let i = 0; i < daysMissed; i++) {
        const bonusRef = db.collection('bonuses').doc();
        // create dummy past dates for the bonuses
        const bonusDate = new Date(pDateMs + (i + 1) * 86400000); 
        batch.set(bonusRef, {
          userId: uid,
          type: 'daily_roi',
          amount: dailyRoi,
          sourceId: doc.id,
          desc: `Catch-up interest for ${bonusDate.toISOString().slice(0, 10)}`,
          createdAt: admin.firestore.Timestamp.fromDate(bonusDate)
        });
      }
      
      await batch.commit();
      console.log(` + Successfully applied catch-up for ${username}`);
      totalUpdated++;
    }
  }
  
  console.log(`\nCatch-up completed! Total investments fixed: ${totalUpdated}`);
}

run().catch(console.error);
