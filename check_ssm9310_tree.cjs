const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function check() {
  const usersSnap = await db.collection('users').get();
  const users = {};
  const childrenMap = {};
  let targetUid = null;

  usersSnap.forEach(d => {
    const u = d.data();
    u.uid = d.id;
    users[d.id] = u;
    if (u.username === 'ssm9310') {
        targetUid = d.id;
    }
    
    const parentId = u.referredBy;
    if (parentId) {
        if (!childrenMap[parentId]) childrenMap[parentId] = [];
        childrenMap[parentId].push(d.id);
    }
  });

  if (!targetUid) {
      console.log("User ssm9310 not found.");
      return;
  }

  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  const invByUser = {};
  invSnap.forEach(d => {
    const inv = d.data();
    const uid = inv.userId;
    const amt = inv.amount || 0;
    if (!invByUser[uid]) invByUser[uid] = 0;
    invByUser[uid] += amt;
  });

  const descendants = [];
  function traverse(uid) {
      const children = childrenMap[uid] || [];
      for (const childUid of children) {
          descendants.push(childUid);
          traverse(childUid);
      }
  }
  traverse(targetUid);

  const mismatches = [];
  let totalActualDescendantInvest = 0;
  let totalRecordedDescendantInvest = 0;

  for (const uid of descendants) {
      const u = users[uid];
      const actual = invByUser[uid] || 0;
      const recorded = u.totalInvested || 0;
      
      totalActualDescendantInvest += actual;
      totalRecordedDescendantInvest += recorded;

      if (Math.abs(actual - recorded) > 0.01) {
          mismatches.push({
              username: u.username,
              actual: actual,
              recorded: recorded,
              missing: actual - recorded
          });
      }
  }

  console.log(`[ ssm9310 계정 하부 조직 전수조사 (조회 전용) ]`);
  console.log(`- 하위 파트너 수: 총 ${descendants.length} 명\n`);
  
  if (mismatches.length > 0) {
      console.log(`[ 개별 파트너 원금 누락/불일치 목록: ${mismatches.length} 명 ]`);
      console.table(mismatches);
  } else {
      console.log(`개별 파트너들의 활성 투자원금과 기록된 총 투자금(totalInvested)은 모두 일치합니다.\n`);
  }

  const ssm9310 = users[targetUid];
  console.log(`\n[ ssm9310 산하 전체 매출(networkSales) 데이터 비교 ]`);
  console.log(`- 하부 전체의 "실제" 활성 투자금 총합 : ${totalActualDescendantInvest} USDT`);
  console.log(`- 하부 전체의 "기록된" 총 투자금 합계 : ${totalRecordedDescendantInvest} USDT`);
  console.log(`- 현재 ssm9310의 데이터상 전체 합계(산하매출) : ${ssm9310.networkSales || 0} USDT`);
  
  const diff = totalActualDescendantInvest - (ssm9310.networkSales || 0);
  if (diff !== 0) {
      console.log(`=> 결론: ssm9310 회원님의 산하 매출에서 **${diff} USDT** 가 누락(차이)되어 있습니다.`);
  } else {
      console.log(`=> 결론: ssm9310 회원님의 산하 매출이 정상적으로 모두 반영되어 있습니다.`);
  }
}
check().catch(console.error).finally(() => process.exit(0));
