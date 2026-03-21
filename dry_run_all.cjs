const admin = require('firebase-admin');
const fs = require('fs');
const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); }
const db = admin.firestore();

async function run() {
  const snap = await db.collection('settings').doc('rankPromotion').get();
  let settings = snap.data() || {};
  if (settings.criteriaJson) {
      settings.criteria = JSON.parse(settings.criteriaJson);
  }

  const criteria  = settings.criteria || {};
  const mode      = settings.promotionMode || 'all';
  const preventDowngrade        = settings.preventDowngrade !== false;
  const countOnlyDirect         = settings.countOnlyDirectReferrals === true;
  const useBalancedVol          = settings.useBalancedVolume === true;
  const excludeTopLines         = settings.excludeTopLines || 1;
  const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];

  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const walletsSnap = await db.collection('wallets').get();
  const walletMap = {};
  walletsSnap.docs.forEach(d => {
      walletMap[d.data().userId || d.id] = (d.data().totalInvested || d.data().totalInvest || 0);
  });

  const investmentsSnap = await db.collection('investments').where('status', '==', 'active').get();
  const investMap = {};
  investmentsSnap.docs.forEach(d => {
      const data = d.data();
      investMap[data.userId] = (investMap[data.userId] || 0) + (data.amount || 0);
  });

  const depth = countOnlyDirect ? 1 : (settings.networkDepth || 3);
  let changed = [];

  for (const member of allUsers) {
      if (member.role === 'admin') continue;
      if (member.manualRankSet) continue; 
      
      const curRank = member.rank || 'G0';
      const curIdx = RANK_ORDER.indexOf(curRank);
      
      const downline = [];
      let lvl = [member.id];
      const scanDepth = countOnlyDirect ? 1 : depth;
      for (let d = 0; d < scanDepth; d++) {
          const next = allUsers.filter(u => lvl.includes(u.referredBy)).map(u => u.id);
          downline.push(...next);
          lvl = next;
          if (!next.length) break;
      }
      
      const selfInvest = investMap[member.id] || 0;

      let networkSales = 0;
      if (downline.length > 0) {
          downline.forEach(uid => {
              networkSales += (walletMap[uid] || 0);
          });
      }

      let balancedVolume = networkSales;
      if (useBalancedVol && downline.length > 0) {
          balancedVolume = 0;
          let lines = [];
          const directChildren = allUsers.filter(u => u.referredBy === member.id);
          for (const child of directChildren) {
              let cDist = { [child.id]: 1 };
              let cq = [child.id];
              let cdLines = [child.id];
              while (cq.length > 0) {
                  const c = cq.shift();
                  const cDepth = cDist[c];
                  if (cDepth < scanDepth) {
                      const subChildren = allUsers.filter(u => u.referredBy === c);
                      for (const sc of subChildren) {
                          cDist[sc.id] = cDepth + 1;
                          cq.push(sc.id);
                          cdLines.push(sc.id);
                      }
                  }
              }
              
              let currentLineInvest = 0;
              let chunkQ = [child.id, ...cdLines];
              chunkQ.forEach(uid => {
                  currentLineInvest += (walletMap[uid] || 0);
              });
              lines.push(currentLineInvest);
          }
          lines.sort((a, b) => b - a);
          balancedVolume = lines.slice(excludeTopLines).reduce((sum, val) => sum + val, 0);
      }

      let targetIdx = 0;
      for (let i = RANK_ORDER.length - 1; i >= 1; i--) {
          const rankId = RANK_ORDER[i];
          const crit   = criteria[rankId];
          if (!crit) continue;
          
          const meetsInvest = selfInvest >= (crit.minSelfInvest || 0);
          const meetsBV = balancedVolume >= (crit.minBalancedVolume || 0);
          
          if (meetsInvest && meetsBV) {
              targetIdx = i;
              break;
          }
      }
      
      // preventDowngrade applies
      if (preventDowngrade && targetIdx < curIdx) {
          targetIdx = curIdx;
      }

      const newRank = RANK_ORDER[targetIdx];
      if (newRank !== curRank) {
          changed.push({
              name: member.name,
              email: member.email,
              old: curRank,
              new: newRank,
              invest: selfInvest,
              bv: balancedVolume
          });
      }
  }
  
  console.log(`\n=== Dry Run Results (승급/강등 예상 대상자) ===`);
  if (changed.length === 0) {
      console.log("변경 대상자가 없습니다.");
  } else {
      changed.forEach(c => {
          console.log(`- ${c.name} (${c.email}): ${c.old} -> ${c.new} (본인투자: $${c.invest}, 균형매출: $${c.bv})`);
      });
  }
}
run().catch(console.error);
