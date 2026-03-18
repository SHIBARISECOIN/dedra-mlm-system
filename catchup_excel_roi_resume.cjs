const admin = require('firebase-admin');
const fs = require('fs');
const XLSX = require('xlsx');

// 1. Firebase 초기화
const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/)?.[1];
const pK = (idxContent.match(/private_key:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/)?.[1]).replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/)?.[1];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
}
const db = admin.firestore();

function getDatesInRange(startDateStr, endDateStr) {
  const dates = [];
  let curr = new Date(startDateStr);
  const end = new Date(endDateStr);
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

async function run() {
  console.log("엑셀 데이터 로드 중...");
  const wb = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`총 ${data.length}건의 레코드 확인됨. 유저 맵핑 시작...`);

  const usersSnap = await db.collection('users').get();
  const userMap = {}; 
  usersSnap.docs.forEach(doc => {
    const u = doc.data();
    if (u.username) userMap[u.username.toLowerCase()] = doc.id;
  });

  const todayStr = '2026-03-18'; 
  let totalUpdatedUsers = 0;
  let totalMissingAmountAll = 0;
  let missingBonusesCreated = 0;
  
  const BATCH_SIZE = 20;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const promises = chunk.map(async (row) => {
      const rawUsername = row['member_id'];
      if (!rawUsername) return null;
      const username = String(rawUsername).trim().toLowerCase();
      const uid = userMap[username];
      
      if (!uid) return null;

      const purchaseDate = row['purchase_date']; 
      const rawRate = row['interest_rate']; 
      const paymentAmount = Number(row['payment_amount']);

      if (!purchaseDate || !rawRate || isNaN(paymentAmount)) return null;

      const dailyRoiPct = Number(String(rawRate).replace('%', '').trim());
      if (isNaN(dailyRoiPct) || dailyRoiPct <= 0) return null;

      const dailyEarning = parseFloat((paymentAmount * (dailyRoiPct / 100)).toFixed(8));

      const invSnap = await db.collection('investments').where('userId', '==', uid).where('status', '==', 'active').get();
      for (const invDoc of invSnap.docs) {
        const invData = invDoc.data();
        if (invData.dailyRoi !== dailyRoiPct || invData.startDate !== purchaseDate) {
          await invDoc.ref.update({
            dailyRoi: dailyRoiPct,
            startDate: invData.startDate || purchaseDate,
          });
        }
      }

      const expectedDates = getDatesInRange(purchaseDate, todayStr);
      
      const bonusesSnap = await db.collection('bonuses')
        .where('userId', '==', uid)
        .where('type', '==', 'daily_roi')
        .get();
        
      const paidDates = new Set();
      bonusesSnap.docs.forEach(b => {
        const bData = b.data();
        const bDate = bData.settlementDate || (bData.createdAt && bData.createdAt.toDate ? bData.createdAt.toDate().toISOString().slice(0, 10) : null);
        if (bDate) paidDates.add(bDate);
      });

      let userMissingAmount = 0;
      const batch = db.batch();
      let batchCount = 0;

      for (const dStr of expectedDates) {
        if (!paidDates.has(dStr)) {
          userMissingAmount += dailyEarning;

          const newBonusRef = db.collection('bonuses').doc();
          batch.set(newBonusRef, {
            userId: uid,
            type: 'daily_roi',
            amount: dailyEarning,
            amountUsdt: dailyEarning,
            description: `Excel 소급 이자 (${dStr})`,
            settlementDate: dStr,
            origin: 'sys_catchup',
            createdAt: admin.firestore.Timestamp.fromDate(new Date(`${dStr}T12:00:00Z`))
          });
          batchCount++;
        }
      }

      if (userMissingAmount > 0) {
        const walletRef = db.collection('wallets').doc(uid);
        batch.update(walletRef, {
          bonusBalance: admin.firestore.FieldValue.increment(userMissingAmount),
          totalEarnings: admin.firestore.FieldValue.increment(userMissingAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
      }

      if (batchCount > 0) {
        await batch.commit();
        return { userMissingAmount, batchCount };
      }
      return null;
    });

    const results = await Promise.all(promises);
    for (const res of results) {
      if (res) {
        totalUpdatedUsers++;
        totalMissingAmountAll += res.userMissingAmount;
        missingBonusesCreated += res.batchCount - 1; // subtract wallet update
      }
    }
    
    console.log(`[${i + chunk.length}/${data.length}] 진행 중... 현재까지 업데이트: ${totalUpdatedUsers}명`);
  }

  console.log('====================================');
  console.log(`작업 완료!`);
  console.log(`- 업데이트된 유저 수: ${totalUpdatedUsers}명`);
  console.log(`- 추가된 누락 보너스 건수: ${missingBonusesCreated}건`);
  console.log(`- 총 지급된 소급 이자(USDT): $${totalMissingAmountAll.toFixed(4)}`);
  console.log('====================================');
}

run().then(() => process.exit(0)).catch(e => {
  console.error("에러 발생:", e);
  process.exit(1);
});
