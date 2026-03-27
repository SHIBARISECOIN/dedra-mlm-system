const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const jackpotLogic = `
    // --- 잭팟 로직 추가 ---
    try {
      const jpRef = window.FB.doc(window.FB.db, 'events', 'jackpot');
      const jpSnap = await window.FB.getDoc(jpRef);
      if (jpSnap.exists()) {
        const jpData = jpSnap.data();
        if (jpData.active && jpData.endTime > Date.now()) {
          const duration = jpData.durationHours || 24;
          const maskedName = currentUser.email ? currentUser.email.split('@')[0].substring(0, 3) + '***' : 'user***';
          await window.FB.updateDoc(jpRef, {
            endTime: Date.now() + (duration * 3600 * 1000),
            lastInvestor: currentUser.email || currentUser.uid,
            lastInvestorMasked: maskedName
          });
        }
      }
    } catch(err) { console.error('Jackpot update error:', err); }
`;

const startIdx = code.indexOf('window.submitInvest = async function() {');
const targetStr = '// 로컬 walletData도 즉시 반영';
const targetIdx = code.indexOf(targetStr, startIdx);

if (startIdx !== -1 && targetIdx !== -1) {
  code = code.slice(0, targetIdx) + jackpotLogic + '\n    ' + code.slice(targetIdx);
  fs.writeFileSync('public/static/app.js', code);
  console.log('Patched jackpot logic into submitInvest correctly');
} else {
  console.log('Failed to find target in submitInvest');
}
