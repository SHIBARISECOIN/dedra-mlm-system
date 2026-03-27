const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

const newJackpotLogic = `
    // --- 잭팟 로직 추가 ---
    try {
      const jpRef = typeof window !== 'undefined' && window.FB && window.FB.doc ? window.FB.doc(window.FB.db, 'events', 'jackpot') : doc(db, 'events', 'jackpot');
      const getDocFn = typeof window !== 'undefined' && window.FB && window.FB.getDoc ? window.FB.getDoc : getDoc;
      const jpSnap = await getDocFn(jpRef);
      if (jpSnap.exists()) {
        const jpData = jpSnap.data();
        if (jpData.active && jpData.endTime > Date.now()) {
          const duration = jpData.durationHours || 24;
          const maskedName = currentUser.email ? currentUser.email.split('@')[0].substring(0, 3) + '***' : 'user***';
          const uidOrEmail = currentUser.email || currentUser.uid;
          
          let updatePayload = {
            endTime: Date.now() + (duration * 3600 * 1000),
            lastInvestor: uidOrEmail,
            lastInvestorMasked: maskedName,
            updatedAt: typeof window !== 'undefined' && window.FB && window.FB.serverTimestamp ? window.FB.serverTimestamp() : serverTimestamp()
          };
          
          if (jpData.lastInvestor !== uidOrEmail) {
            updatePayload.changeCount = typeof window !== 'undefined' && window.FB && window.FB.increment ? window.FB.increment(1) : increment(1);
          }
          
          const updateDocFn = typeof window !== 'undefined' && window.FB && window.FB.updateDoc ? window.FB.updateDoc : updateDoc;
          await updateDocFn(jpRef, updatePayload);
        }
      }
    } catch(err) { console.error('Jackpot update error:', err); }
`;

// There are duplicates from ~5780 to ~5815. Let's find exactly the block and replace.
// Block 1 (duplicate)
const searchStr1 = `    // --- 잭팟 로직 추가 ---
    try {
      const jpRef = doc(db, 'events', 'jackpot');
      const jpSnap = await window.FB.getDoc(jpRef);
      if (jpSnap.exists()) {
        const jpData = jpSnap.data();
        if (jpData.active && jpData.endTime > Date.now()) {
          const duration = jpData.durationHours || 24;
          const maskedName = currentUser.email ? currentUser.email.split('@')[0].substring(0, 3) + '***' : 'user***';
          await window.FB.updateDoc(jpRef, {
            endTime: Date.now() + (duration * 3600 * 1000),
            lastInvestor: maskedName,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch(err) { console.error('Jackpot update error:', err); }


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
    } catch(je) { console.error('Jackpot update failed', je); }`;

if (appJs.includes(searchStr1)) {
  appJs = appJs.replace(searchStr1, newJackpotLogic);
  console.log("Replaced first block");
} else {
  console.log("Could not find first block");
}

const searchStr2 = `    // --- 잭팟 로직 추가 ---
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
    } catch(err) { console.error('Jackpot update error:', err); }`;

if (appJs.includes(searchStr2)) {
  appJs = appJs.replace(searchStr2, newJackpotLogic);
  console.log("Replaced second block");
} else {
  console.log("Could not find second block");
}

fs.writeFileSync('public/static/app.js', appJs);
