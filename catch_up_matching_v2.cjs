const admin = require('firebase-admin');
const fs = require('fs');

const saContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const clientEmail = saContent.match(/client_email:\s*"([^"]+)"/)[1];
const privateKey = saContent.match(/private_key:\s*"([^"]+)"/)[1].replace(/\\n/g, '\n');
const projectId = saContent.match(/project_id:\s*"([^"]+)"/)[1];

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}
const db = admin.firestore();

// 4-core logic needs ranks
const RANKS = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];
function getRankLevel(rank) {
  const r = rank || 'G0';
  return RANKS.indexOf(r) >= 0 ? RANKS.indexOf(r) : 0;
}

async function run() {
  const priceDoc = await db.collection('settings').doc('deedraPrice').get();
  const dedraRate = priceDoc.exists ? (priceDoc.data().price || 0.5) : 0.5;

  const ratesDoc = await db.collection('settings').doc('rates').get();
  const ratesData = ratesDoc.exists ? ratesDoc.data() : {};
  const config = {
    direct1: Number(ratesData.rate_direct1 ?? 10),
    direct2: Number(ratesData.rate_direct2 ?? 5),
    rankGap: Number(ratesData.rate_rankGap ?? 1),
    override: Number(ratesData.rate_override ?? 1),
    centerFee: Number(ratesData.rate_centerFee ?? 5)
  };

  console.log("Config loaded:", config, "Deedra Rate:", dedraRate);

  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.docs.forEach(d => userMap.set(d.id, { id: d.id, ...d.data() }));
  
  const bonusesSnap = await db.collection('bonuses').where('type', '==', 'daily_roi').get();
  const catchups = bonusesSnap.docs.filter(d => {
    const data = d.data();
    return data.desc && data.desc.startsWith('Catch-up interest') && !data.matchingProcessed;
  });
  console.log("Catch-up ROIs to process matching for:", catchups.length);
  if (catchups.length === 0) return;

  let matchingBonusesCreated = 0;
  const walletUpdates = new Map(); 
  const newBonuses = [];

  for (const doc of catchups) {
    const data = doc.data();
    const sourceUserId = data.userId;
    const dailyEarning = data.amount || data.amountUsdt || 0; 
    const catchUpDateStr = data.desc.split('for ')[1]; 

    const sourceUser = userMap.get(sourceUserId);
    if (!sourceUser) continue;

    const payMatchingBonus = (receiverId, type, amountUsdt, reason, level) => {
      if (amountUsdt <= 0) return;
      if (!walletUpdates.has(receiverId)) walletUpdates.set(receiverId, { addBonus: 0, addEarning: 0 });
      const wu = walletUpdates.get(receiverId);
      wu.addBonus += amountUsdt;
      wu.addEarning += amountUsdt;
      
      newBonuses.push({
        userId: receiverId,
        fromUserId: sourceUser.id,
        type,
        amount: amountUsdt / dedraRate,
        amountUsdt,
        baseIncome: dailyEarning,
        reason,
        level: level || 0,
        createdAt: new Date(),
        settlementDate: catchUpDateStr 
      });
      matchingBonusesCreated++;
    };

    const upline1 = sourceUser.referredBy ? userMap.get(sourceUser.referredBy) : null;
    if (upline1) {
      payMatchingBonus(upline1.id, 'direct_bonus', dailyEarning * (config.direct1 / 100), `1대 추천 매칭 [소급:${catchUpDateStr}]`, 1);
      const upline2 = upline1.referredBy ? userMap.get(upline1.referredBy) : null;
      if (upline2) payMatchingBonus(upline2.id, 'direct_bonus', dailyEarning * (config.direct2 / 100), `2대 추천 매칭 [소급:${catchUpDateStr}]`, 2);
    }

    let currentNode = sourceUser;
    let previousRank = getRankLevel(sourceUser.rank || 'G0');
    let rollUpDepth = 1;

    while (currentNode && currentNode.referredBy) {
      const parent = userMap.get(currentNode.referredBy);
      if (!parent) break;

      const parentRank = getRankLevel(parent.rank || 'G0');
      if (currentNode.id === sourceUser.id && previousRank >= parentRank) {
        if (parentRank > 0) payMatchingBonus(parent.id, 'rank_equal_or_higher_override_1pct', dailyEarning * (config.override / 100), `동급/상위 직속 예외 ${config.override}% [소급:${catchUpDateStr}]`, rollUpDepth);
        currentNode = parent; rollUpDepth++; continue;
      }
      if (parentRank > 0 && parentRank > previousRank) {
        const rankGap = parentRank - previousRank;
        const gapBonus = dailyEarning * (rankGap * config.rankGap / 100);
        payMatchingBonus(parent.id, 'rank_bonus', gapBonus, `판권 매칭 ${rankGap * config.rankGap}% [소급:${catchUpDateStr}]`, rollUpDepth);
        previousRank = parentRank;
      }
      currentNode = parent; rollUpDepth++;
    }
  }

  console.log(`Writing ${newBonuses.length} bonuses...`);
  
  // Use BulkWriter
  const bulkWriter = db.bulkWriter();
  newBonuses.forEach(b => {
    bulkWriter.set(db.collection('bonuses').doc(), b);
  });
  
  catchups.forEach(doc => {
    bulkWriter.update(doc.ref, { matchingProcessed: true, amountUsdt: doc.data().amount });
  });

  await bulkWriter.close();
  console.log("Finished writing bonuses and updating ROI docs.");

  // Fast wallet updates without runTransaction for every single one since it's a batch offline script
  console.log(`Updating ${walletUpdates.size} wallets...`);
  const wBulk = db.bulkWriter();
  for (const [uid, updates] of walletUpdates.entries()) {
    wBulk.update(db.collection('wallets').doc(uid), {
      bonusBalance: admin.firestore.FieldValue.increment(updates.addBonus),
      totalEarnings: admin.firestore.FieldValue.increment(updates.addEarning),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  await wBulk.close();
  console.log("Wallets updated.");
  console.log(`Summary: Processed ${catchups.length} catch-up ROIs. Created ${matchingBonusesCreated} matching bonuses.`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
