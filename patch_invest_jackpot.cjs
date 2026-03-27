const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

// Add jackpot update after batch.commit() in submitInvest
const targetStr = `await batch.commit();`;
if (!appJs.includes('// --- 잭팟 로직 추가 ---')) {
    const injection = `
    // --- 잭팟 로직 추가 ---
    try {
      const jpRef = doc(db, 'events', 'jackpot');
      const jpSnap = await window.FB.getDoc(jpRef);
      if (jpSnap.exists()) {
        const jpData = jpSnap.data();
        if (jpData.active && jpData.endTime > Date.now()) {
          const duration = jpData.durationHours || 24;
          const maskedName = currentUser.email ? currentUser.email.split('@')[0].substring(0, 3) + '***' : 'user***';
          await updateDoc(jpRef, {
            endTime: Date.now() + (duration * 3600 * 1000),
            lastInvestor: currentUser.email || currentUser.uid,
            lastInvestorMasked: maskedName
          });
        }
      }
    } catch(je) { console.error('Jackpot update failed', je); }
    // -----------------------
`;
    appJs = appJs.replace(targetStr, targetStr + '\n' + injection);
}

// Modify renderJackpotBanner to show the last investor
if (appJs.includes('renderJackpotBanner') && !appJs.includes('jpLastInvestorSpan')) {
    appJs = appJs.replace(
        '<span style="color: #fbbf24;">${amountStr}</span> USDT',
        '<span style="color: #fbbf24;">${amountStr}</span> USDT\n        </div>\n        <div style="margin-top:8px; font-size: 13px; color: #38bdf8; font-weight: bold;">현재 1위: <span id="jpLastInvestorSpan">${data.lastInvestorMasked || "아직 없음"}</span>'
    );
}

fs.writeFileSync('public/static/app.js', appJs);
console.log('Patched submitInvest with jackpot update logic');
