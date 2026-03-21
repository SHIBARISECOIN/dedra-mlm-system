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
  const requireActiveInvestment = settings.requireActiveInvestment === true;
  const countOnlyDirect         = settings.countOnlyDirectReferrals === true;
  const useBalancedVol          = settings.useBalancedVolume === true;
  const excludeTopLines         = settings.excludeTopLines || 1;
  const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];

  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const targetUser = allUsers.find(u => u.email === 'cyj0300@deedra.com');
  const depth = countOnlyDirect ? 1 : (settings.networkDepth || 3);
  
  const member = targetUser;
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
  
  const selfInvSnap = await db.collection('investments').where('userId', '==', member.id).where('status', '==', 'active').get();
  const selfInvest = selfInvSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);

  let networkSales = 0;
  if (downline.length > 0) {
      const chunks = [];
      for (let i = 0; i < downline.length; i += 30) chunks.push(downline.slice(i, i + 30));
      for (const chunk of chunks) {
          const wSnap = await db.collection('wallets').where('userId', 'in', chunk).get();
          networkSales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);
      }
  }

  let balancedVolume = networkSales;
  if (useBalancedVol && downline.length > 0) {
      // Simplified manual balanced volume calc
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
          for (let i = 0; i < chunkQ.length; i += 30) {
              const ch = chunkQ.slice(i, i + 30);
              const wc = await db.collection('wallets').where('userId', 'in', ch).get();
              wc.forEach(dw => {
                  currentLineInvest += (dw.data().totalInvested || dw.data().totalInvest || 0);
              });
          }
          lines.push(currentLineInvest);
      }
      lines.sort((a, b) => b - a);
      balancedVolume = lines.slice(excludeTopLines).reduce((sum, val) => sum + val, 0);
  }

  const networkMembers = downline.length;
  console.log(`selfInvest: ${selfInvest}, networkSales: ${networkSales}, balancedVolume: ${balancedVolume}, members: ${networkMembers}`);

  let targetIdx = 0;
  for (let i = RANK_ORDER.length - 1; i >= 1; i--) {
      const rankId = RANK_ORDER[i];
      const crit   = criteria[rankId];
      if (!crit) continue;
      const cInvest  = selfInvest     >= (crit.minSelfInvest     || 0);
      const cSales   = networkSales   >= (crit.minNetworkSales   || 0);
      const cBV      = balancedVolume >= (crit.minBalancedVolume || 0);
      const cMembers = networkMembers >= (crit.minNetworkMembers || 0);
      
      const hasAnyCrit = (crit.minSelfInvest||0)>0 || (crit.minNetworkSales||0)>0 || (crit.minBalancedVolume||0)>0 || (crit.minNetworkMembers||0)>0;
      if (!hasAnyCrit) continue;
      
      const bvRequired = (crit.minBalancedVolume || 0) > 0;
      const pass = mode === 'any'
        ? (cInvest || cSales || (bvRequired && cBV) || cMembers)
        : (cInvest && cSales && (!bvRequired || cBV) && cMembers);

      console.log(`[${rankId}] cInvest:${cInvest}, cSales:${cSales}, cBV:${cBV}, cMembers:${cMembers} -> pass: ${pass}`);

      if (pass) {
          targetIdx = i;
          break;
      }
  }
  console.log(`Final Rank: ${RANK_ORDER[targetIdx]}`);
}
run().catch(console.error);
