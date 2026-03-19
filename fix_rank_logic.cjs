const fs = require('fs');
const path = '/home/user/webapp/public/static/js/api.js';
let code = fs.readFileSync(path, 'utf-8');

// Replace the `passes` condition in _checkAndPromoteSingleUser
const oldPassesLogic = `      const passes = mode === 'any'
        ? (meetsInvest || meetsSales || (bvRequired && meetsBV) || meetsMembers)
        : (meetsInvest && meetsSales && (!bvRequired || meetsBV) && meetsMembers);`;

const newPassesLogic = `      // ──────────────────────────────────────────────────────────
      // [요청사항 적용] 직급 승격은 오직 "본인 투자금"과 "균형 매출" 2가지만 봅니다.
      // 산하 총 매출(meetsSales)이나 하부 인원수(meetsMembers)는 조건에서 무시합니다.
      // 수동 승격된 유저는 여기서 제외되도록 이 함수 시작부분에 처리됨.
      // ──────────────────────────────────────────────────────────
      const passes = meetsInvest && meetsBV;`;

code = code.replace(oldPassesLogic, newPassesLogic);

// Add manualRankSet bypass at the top of _checkAndPromoteSingleUser
const oldMemberCheck = `    const member = { id: userSnap.id, ...userSnap.data() };
    if (member.role === 'admin') return;`;

const newMemberCheck = `    const member = { id: userSnap.id, ...userSnap.data() };
    if (member.role === 'admin') return;
    // 관리자가 수동으로 직급을 지정한 회원은 자동 승격 심사에서 제외
    if (member.manualRankSet) return;`;

code = code.replace(oldMemberCheck, newMemberCheck);

// Do the same in runBatchRankPromotion loop
const oldBatchLoop = `      for (const u of members) {
        if (Date.now() - startTime > 14000) break; // Vercel/CF 시간제한 회피
        await this._checkAndPromoteSingleUser(u.id, settings, adminId);
        processed++;
      }`;

const newBatchLoop = `      for (const u of members) {
        if (Date.now() - startTime > 14000) break; // Vercel/CF 시간제한 회피
        // 수동 지정 대상자는 제외
        if (!u.manualRankSet) {
          await this._checkAndPromoteSingleUser(u.id, settings, adminId);
        }
        processed++;
      }`;

code = code.replace(oldBatchLoop, newBatchLoop);

// Inject runRankAllClear method
const allClearMethod = `
  async runRankAllClear(adminId) {
    try {
      const db = this.db;
      const usersSnap = await getDocs(collection(db, 'users'));
      const members = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin');

      let changedCount = 0;
      // 1. 모든 회원의 직급을 G0으로 강등 (수동 설정자 제외 여부: "관리자가 강제로 주입시킨 거는 제외" -> 수동 설정자는 초기화 안함)
      const chunks = [];
      for (let i = 0; i < members.length; i += 500) chunks.push(members.slice(i, i + 500));
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        let hasOps = false;
        for (const u of chunk) {
          if (!u.manualRankSet && u.rank !== 'G0') {
            batch.update(doc(db, 'users', u.id), { rank: 'G0' });
            hasOps = true;
            changedCount++;
          }
        }
        if (hasOps) await batch.commit();
      }

      // 2. 전체 재계산 실행
      await this.runBatchRankPromotion(adminId);

      return ok(\`초기화 후 전체 재심사 완료! (초기화된 일반 회원: \${changedCount}명)\`);
    } catch(e) { return err(e); }
  }
`;

if (!code.includes('runRankAllClear(adminId)')) {
  code = code.replace('async runBatchRankPromotion(adminId) {', allClearMethod + '\n  async runBatchRankPromotion(adminId) {');
}

fs.writeFileSync(path, code);
console.log('api.js patched successfully');
