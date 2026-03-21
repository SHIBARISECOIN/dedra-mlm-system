const admin = require('firebase-admin');

// 1. Initialize Firebase Admin SDK
const SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "dedra-mlm",
  "private_key_id": "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  "client_id": "103096684164693920388",
  "token_uri": "https://oauth2.googleapis.com/token",
  "project_id_full": "dedra-mlm"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT)
  });
}
const db = admin.firestore();

async function run() {
  // Get Rank Settings
  const snap = await db.collection('settings').doc('rankPromotion').get();
  let settings = snap.data() || {};
  if (settings.criteriaJson) {
      settings.criteria = JSON.parse(settings.criteriaJson);
  }

  // Define logic
  const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
  const criteria         = settings.criteria || {};
  const mode             = settings.promotionMode || 'all';
  const preventDowngrade = settings.preventDowngrade !== false;
  const countOnlyDirect  = settings.countOnlyDirectReferrals === true;
  const useBalancedVol   = settings.useBalancedVolume === true;
  const excludeTopLines  = settings.excludeTopLines || 1;
  const depth = countOnlyDirect ? 1 : (settings.networkDepth || 3);

  console.log("=== Settings ===");
  console.log(`useBalancedVol: ${useBalancedVol}, excludeTopLines: ${excludeTopLines}, depth: ${depth}, countOnlyDirect: ${countOnlyDirect}`);

  // We are checking user mark (cyj0300@deedra.com)
  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const targetUser = allUsers.find(u => u.email === 'cyj0300@deedra.com');
  if(!targetUser) {
      console.log("User not found.");
      return;
  }
  
  const userId = targetUser.id;
  console.log(`\n=== Checking User: ${targetUser.name} (${targetUser.email}) ===`);
  console.log(`Current Rank: ${targetUser.rank}, manualRankSet: ${targetUser.manualRankSet}`);

  // Fetch target user's wallet
  const wSnap = await db.collection('wallets').doc(userId).get();
  const selfInvest = (wSnap.data()?.totalInvested || wSnap.data()?.totalInvest || 0);
  console.log(`본인 투자금 (Self Invest): $${selfInvest}`);

  // BFS Downlines
  let queue = [userId];
  let downline = [];
  let distances = { [userId]: 0 };

  while (queue.length > 0) {
      const current = queue.shift();
      const currentDepth = distances[current];

      if (currentDepth < depth) {
          const children = allUsers.filter(u => u.referredBy === current);
          for (const child of children) {
              distances[child.id] = currentDepth + 1;
              queue.push(child.id);
              downline.push(child.id);
          }
      }
  }

  // Network Sales Calculation
  let networkSales = 0;
  let totalInvestMap = {};

  const MAX_CHUNK = 30;
  for (let i = 0; i < downline.length; i += MAX_CHUNK) {
      const chunk = downline.slice(i, i + MAX_CHUNK);
      const wQ = await db.collection('wallets').where('userId', 'in', chunk).get();
      wQ.forEach(doc => {
          const wData = doc.data();
          const inv = wData.totalInvested || wData.totalInvest || 0;
          totalInvestMap[wData.userId] = inv;
          networkSales += inv;
      });
  }
  
  let balancedVolume = 0;
  let lines = [];
  if (useBalancedVol) {
      const directChildren = allUsers.filter(u => u.referredBy === userId);
      for (const child of directChildren) {
          let lineTotal = 0;
          let cq = [child.id];
          let cDist = { [child.id]: 1 };
          let cdLines = [child.id];

          while (cq.length > 0) {
              const c = cq.shift();
              const cDepth = cDist[c];
              if (cDepth < depth) {
                  const subChildren = allUsers.filter(u => u.referredBy === c);
                  for (const sc of subChildren) {
                      cDist[sc.id] = cDepth + 1;
                      cq.push(sc.id);
                      cdLines.push(sc.id);
                  }
              }
          }

          let chunkQ = [child.id, ...cdLines];
          let currentLineInvest = 0;
          for (let i = 0; i < chunkQ.length; i += MAX_CHUNK) {
              const ch = chunkQ.slice(i, i + MAX_CHUNK);
              const wc = await db.collection('wallets').where('userId', 'in', ch).get();
              wc.forEach(dw => {
                  currentLineInvest += (dw.data().totalInvested || dw.data().totalInvest || 0);
              });
          }
          lines.push(currentLineInvest);
          console.log(`Leg (${child.name}): $${currentLineInvest}`);
      }
      lines.sort((a, b) => b - a); // descending
      
      const excludedTotal = lines.slice(0, excludeTopLines).reduce((sum, val) => sum + val, 0);
      balancedVolume = lines.slice(excludeTopLines).reduce((sum, val) => sum + val, 0);
      
      console.log(`Sorted Legs: ${JSON.stringify(lines)}`);
      console.log(`Excluded (Top ${excludeTopLines}): $${excludedTotal}`);
  }

  const networkMembers = downline.length;
  console.log(`하부 매출 (Network Sales): $${networkSales}`);
  console.log(`균형 매출 (Balanced Volume): $${balancedVolume}`);
  console.log(`하부 인원 (Network Members): ${networkMembers}`);
  console.log(`\n=== Promotion Logic Check ===`);

  let bestRank = preventDowngrade ? (targetUser.rank || 'G0') : 'G0';
  let bestIdx = RANK_ORDER.indexOf(bestRank);

  for (let i = RANK_ORDER.length - 1; i >= 1; i--) {
      const rankKey = RANK_ORDER[i];
      const c = criteria[rankKey];
      if (!c) continue;

      const meetsInvest  = selfInvest      >= (c.minSelfInvest     || 0);
      const meetsSales   = networkSales    >= (c.minNetworkSales   || 0);
      const meetsMembers = networkMembers  >= (c.minNetworkMembers || 0);
      const meetsBV      = balancedVolume  >= (c.minBalancedVolume || 0);

      // 수정된 로직: meetsInvest && meetsBV 만 체크
      const passed = meetsInvest && meetsBV;
      
      console.log(`[${rankKey}] 요구: 본인투자 >= $${c.minSelfInvest}, 균형매출 >= $${c.minBalancedVolume} (기존하부총매출: ${c.minNetworkSales}, 기존하부인원: ${c.minNetworkMembers})`);
      console.log(`    -> 만족 여부: 본인투자=${meetsInvest}, 균형매출=${meetsBV} => 최종 Pass: ${passed}`);

      if (passed && i > bestIdx) {
          bestRank = rankKey;
          bestIdx = i;
          // Note: In actual code it breaks early, but we won't break to log all
      }
  }

  console.log(`\n>> 최종 산정 직급: ${bestRank}`);
  if(bestRank === (targetUser.rank || 'G0')) {
      console.log("결과: 직급이 변동되지 않습니다.");
  } else {
      console.log(`결과: ${targetUser.rank || 'G0'} -> ${bestRank} 로 승급 대상입니다.`);
  }

  process.exit(0);
}

run().catch(console.error);
