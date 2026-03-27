const fs = require('fs');
const path = './public/static/js/api.js';
let code = fs.readFileSync(path, 'utf-8');

const targetStr = `        // [신규] 하부 회원이 입금했을 때 상위 추천인들에게 마스킹된 입금 알림 전송`;

if (!code.includes(targetStr)) {
  const insertTarget = `        }, adminId);`;
  const newCode = `        }, adminId);
        
        // [신규] 하부 회원이 입금했을 때 상위 추천인들에게 마스킹된 입금 알림 전송
        if (depUserSnap.exists()) {
          try {
            await this.fireReferralDepositNotification(tx.userId, depUser, tx.amount);
          } catch (ne) {
            console.warn('[Deposit Noti] 하부 회원 입금 알림 실패:', ne);
          }
        }`;
        
  code = code.replace(insertTarget, newCode);
  fs.writeFileSync(path, code);
  console.log("Added referral deposit notification hook in approveDeposit.");
}

const functionStr = `async fireReferralDepositNotification`;
if (!code.includes(functionStr)) {
  const insertTargetFunc = `async fireReferralChainNotification(newUserId, newUser) {`;
  const newFunc = `async fireReferralDepositNotification(depUserId, depUser, amount) {
    try {
      // 1) 전체 회원 맵 구성 (referralCode → userId 매핑)
      const usersSnap = await getDocs(collection(this.db, 'users'));
      const codeToUid = {};
      const userMap   = {};
      usersSnap.docs.forEach(d => {
        const u = d.data();
        userMap[d.id] = { id: d.id, ...u };
        if (u.referralCode) codeToUid[u.referralCode] = d.id;
      });

      // 2) referredBy 체인을 따라 올라가며 상위 추천인 수집
      const chain = [];
      let cur = depUser.referredBy ? (codeToUid[depUser.referredBy] || depUser.referredBy) : null;
      const visited = new Set([depUserId]);
      let depth = 0;
      while (cur && !visited.has(cur) && depth < 20) {
        visited.add(cur);
        if (userMap[cur]) chain.push(userMap[cur]);
        cur = userMap[cur]?.referredBy
          ? (codeToUid[userMap[cur].referredBy] || userMap[cur].referredBy)
          : null;
        depth++;
      }

      if (chain.length === 0) return ok({ fired: 0 });

      // 3) 이름 마스킹 처리 (예: 홍길동 -> 홍*동, testuser -> te***er)
      let maskedName = '익명';
      if (depUser.name && depUser.name.length > 0) {
          const n = depUser.name;
          if (n.length <= 2) maskedName = n.charAt(0) + '*';
          else if (n.length === 3) maskedName = n.charAt(0) + '*' + n.charAt(2);
          else maskedName = n.substring(0, 2) + '*'.repeat(n.length - 3) + n.slice(-1);
      } else if (depUser.email) {
          const idPart = depUser.email.split('@')[0];
          if (idPart.length <= 3) maskedName = idPart.charAt(0) + '**';
          else maskedName = idPart.substring(0, 2) + '***' + idPart.slice(-2);
      }

      // 4) 수동 알림 발송 (직접 notifications 컬렉션에 추가)
      const batch = writeBatch(this.db);
      let fired = 0;

      for (const sponsor of chain) {
          const nRef = doc(collection(this.db, 'notifications'));
          batch.set(nRef, {
              userId: sponsor.id,
              title: '💰 하부 파트너 입금 완료!',
              message: \`파트너 \${maskedName} 님께서 \${amount} USDT를 입금하셨습니다. 네트워크 수익이 기대됩니다!\`,
              type: 'push',
              priority: 'normal',
              icon: '💰',
              color: '#10b981',
              isRead: false,
              createdAt: serverTimestamp(),
          });
          fired++;
      }

      await batch.commit();
      return ok({ fired });
    } catch(e) {
      console.warn('[fireReferralDepositNotification] 오류:', e);
      return err(e);
    }
  }

  /**
   * 하부 조직(다단계) 추천인 체인 전체에 '하부 가입 알림' 발송
   */
  async fireReferralChainNotification(newUserId, newUser) {`;
  
  code = code.replace(insertTargetFunc, newFunc);
  fs.writeFileSync(path, code);
  console.log("Added fireReferralDepositNotification function.");
}

