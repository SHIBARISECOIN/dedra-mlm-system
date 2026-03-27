const fs = require('fs');
let code = fs.readFileSync('public/static/js/api.js', 'utf8');

const target = `      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', txId), {
        status: 'approved', approvedAt: serverTimestamp(), approvedBy: adminId
      });
      // 지갑 잔액 증가
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', tx.userId));
      const wSnap = await getDocs(walletQ);
      if (!wSnap.empty) {
        batch.update(wSnap.docs[0].ref, {
          usdtBalance: increment(parseFloat(tx.amount) || 0),
          totalDeposit: increment(parseFloat(tx.amount) || 0),
        });
      }
      await batch.commit();`;

const replacement = `      const batch = writeBatch(db);
      
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', tx.userId));
      const wSnap = await getDocs(walletQ);
      
      let bonusUsdt = 0;
      let bonusPct = 0;
      let originalAmount = parseFloat(tx.amount) || 0;
      let isEligibleForBonus = true;

      if (!wSnap.empty) {
        const wData = wSnap.docs[0].data();
        if ((wData.totalWithdrawal || 0) > 0) {
          isEligibleForBonus = false; // 출금자는 제외
        }
      }

      if (isEligibleForBonus) {
        try {
          const evSnap = await getDoc(doc(db, 'settings', 'bearMarketEvent'));
          if (evSnap.exists()) {
            const evData = evSnap.data();
            const now = new Date();
            let isWithinTime = false;
            
            if (evData.enabled) {
              if (evData.startDate && evData.endDate) {
                const sDate = new Date(evData.startDate);
                const eDate = new Date(evData.endDate);
                if (now >= sDate && now <= eDate) {
                  isWithinTime = true;
                }
              } else if (evData.endDate) {
                 const eDate = new Date(evData.endDate);
                 if (now <= eDate) isWithinTime = true;
              } else {
                 isWithinTime = true; // No dates set, just enabled
              }
            }
            
            if (isWithinTime) {
              const priceSnap = await getDoc(doc(db, 'settings', 'deedraPrice'));
              if (priceSnap.exists()) {
                const pData = priceSnap.data();
                const drop = parseFloat(pData.priceChange24h || 0);
                if (drop < 0) {
                  // 하락장인 경우 (priceChange24h가 음수)
                  bonusPct = Math.abs(drop);
                  bonusUsdt = originalAmount * (bonusPct / 100);
                }
              }
            }
          }
        } catch(err) {
          console.error("Bear market event check failed:", err);
        }
      }

      const totalAddUsdt = originalAmount + bonusUsdt;

      batch.update(doc(db, 'transactions', txId), {
        status: 'approved', 
        approvedAt: serverTimestamp(), 
        approvedBy: adminId,
        bonusUsdt: bonusUsdt,
        bonusPct: bonusPct,
        totalCredited: totalAddUsdt
      });
      
      // 지갑 잔액 증가
      if (!wSnap.empty) {
        batch.update(wSnap.docs[0].ref, {
          usdtBalance: increment(totalAddUsdt),
          totalDeposit: increment(totalAddUsdt),
        });
      }
      await batch.commit();`;

code = code.replace(target, replacement);
fs.writeFileSync('public/static/js/api.js', code);
console.log("Patched api.js successfully.");
