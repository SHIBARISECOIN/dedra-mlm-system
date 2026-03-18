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
  const settings = await db.collection('settings').doc('main').get();
  const settingsData = settings.exists ? settings.data() : {};
  
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

  // Load all users to build tree
  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.docs.forEach(d => userMap.set(d.id, { id: d.id, ...d.data() }));
  console.log("Users loaded:", userMap.size);

  // Load catch-up bonuses (type: daily_roi)
  // We identify them by type='daily_roi' and desc starting with 'Catch-up'
  const bonusesSnap = await db.collection('bonuses').where('type', '==', 'daily_roi').get();
  const catchups = bonusesSnap.docs.filter(d => {
    const data = d.data();
    return data.desc && data.desc.startsWith('Catch-up interest') && !data.matchingProcessed;
  });
  console.log("Catch-up ROIs to process matching for:", catchups.length);

  let processedCount = 0;
  let matchingBonusesCreated = 0;
  let totalMatchingUsdt = 0;

  // We will batch wallet updates
  const walletUpdates = new Map(); // userId -> { addBonus: 0, addEarning: 0 }
  
  // Create matching bonuses list
  const newBonuses = [];

  for (const doc of catchups) {
    const data = doc.data();
    const sourceUserId = data.userId;
    const dailyEarning = data.amount || data.amountUsdt || 0; // Catch-up used amount for USDT (assuming 1:1 if it was USDT)
    const catchUpDateStr = data.desc.split('for ')[1]; // '2026-03-13'
    const todayStr = new Date().toISOString(); // Give it today's timestamp so it shows up in today's earnings

    const sourceUser = userMap.get(sourceUserId);
    if (!sourceUser) continue;

    // Helper
    const payMatchingBonus = (receiverId, type, amountUsdt, reason, level) => {
      if (amountUsdt <= 0) return;
      
      // wallet accumulation
      if (!walletUpdates.has(receiverId)) {
        walletUpdates.set(receiverId, { addBonus: 0, addEarning: 0 });
      }
      const wu = walletUpdates.get(receiverId);
      wu.addBonus += amountUsdt;
      wu.addEarning += amountUsdt;
      
      // add bonus record
      newBonuses.push({
        userId: receiverId,
        fromUserId: sourceUser.id,
        type,
        amount: amountUsdt / dedraRate,
        amountUsdt,
        baseIncome: dailyEarning,
        reason,
        level: level || 0,
        createdAt: new Date(), // using local timestamp
        settlementDate: catchUpDateStr // record which date this was for
      });
      matchingBonusesCreated++;
      totalMatchingUsdt += amountUsdt;
    };

    // 2. Direct Matching (10%, 5%)
    const upline1 = sourceUser.referredBy ? userMap.get(sourceUser.referredBy) : null;
    if (upline1) {
      payMatchingBonus(upline1.id, 'direct_bonus', dailyEarning * (config.direct1 / 100), `1대 추천 매칭 [소급:${catchUpDateStr}] (기준: ${sourceUser.name})`, 1);
      
      const upline2 = upline1.referredBy ? userMap.get(upline1.referredBy) : null;
      if (upline2) {
        payMatchingBonus(upline2.id, 'direct_bonus', dailyEarning * (config.direct2 / 100), `2대 추천 매칭 [소급:${catchUpDateStr}] (기준: ${sourceUser.name})`, 2);
      }
    }

    // 3. Rank Matching (Rank Gap Roll-up)
    let currentNode = sourceUser;
    let previousRank = getRankLevel(sourceUser.rank || 'G0');
    let rollUpDepth = 1;

    while (currentNode && currentNode.referredBy) {
      const parent = userMap.get(currentNode.referredBy);
      if (!parent) break;

      const parentRank = getRankLevel(parent.rank || 'G0');

      if (currentNode.id === sourceUser.id && previousRank >= parentRank) {
        if (parentRank > 0) {
          payMatchingBonus(parent.id, 'rank_equal_or_higher_override_1pct', dailyEarning * (config.override / 100), `동급/상위 직속 예외 ${config.override}% [소급:${catchUpDateStr}] (기준: ${sourceUser.name})`, rollUpDepth);
        }
        currentNode = parent;
        rollUpDepth++;
        continue;
      }

      if (parentRank > 0 && parentRank > previousRank) {
        const rankGap = parentRank - previousRank;
        const gapBonus = dailyEarning * (rankGap * config.rankGap / 100);
        payMatchingBonus(parent.id, 'rank_bonus', gapBonus, `판권 매칭 ${rankGap * config.rankGap}% [소급:${catchUpDateStr}] (기준: ${sourceUser.name})`, rollUpDepth);
        previousRank = parentRank;
      }

      currentNode = parent;
      rollUpDepth++;
    }

    // Mark this catchup as processed
    await doc.ref.update({ matchingProcessed: true, amountUsdt: dailyEarning });
    processedCount++;
  }

  // Batch insert new bonuses
  console.log(`Writing ${newBonuses.length} bonuses...`);
  let batch = db.batch();
  let ops = 0;
  for (const b of newBonuses) {
    const ref = db.collection('bonuses').doc();
    batch.set(ref, b);
    ops++;
    if (ops === 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
      console.log("Committed batch of 400 bonuses");
    }
  }
  if (ops > 0) await batch.commit();
  console.log("Finished writing bonuses.");

  // Update wallets
  console.log(`Updating ${walletUpdates.size} wallets...`);
  batch = db.batch();
  ops = 0;
  for (const [uid, updates] of walletUpdates.entries()) {
    const wRef = db.collection('wallets').doc(uid);
    // Since we don't have atomic read-write here easily without transaction,
    // let's do a fast transaction loop
  }

  // Run transactions for wallets to be safe
  for (const [uid, updates] of walletUpdates.entries()) {
    const wRef = db.collection('wallets').doc(uid);
    await db.runTransaction(async (t) => {
      const snap = await t.get(wRef);
      if (!snap.exists) return;
      const data = snap.data();
      t.update(wRef, {
        bonusBalance: (data.bonusBalance || 0) + updates.addBonus,
        totalEarnings: (data.totalEarnings || 0) + updates.addEarning,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }
  console.log("Wallets updated.");
  console.log(`Summary: Processed ${processedCount} catch-up ROIs. Created ${matchingBonusesCreated} matching bonuses. Total matching amount: $${totalMatchingUsdt}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
