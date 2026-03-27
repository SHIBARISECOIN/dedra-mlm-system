const fs = require('fs');
let code = fs.readFileSync('public/static/admin.html', 'utf8');

const targetHtml = `window.saveJackpotSettings = async function() {
  const active = document.getElementById('jackpotActive').checked;
  const amount = parseFloat(document.getElementById('jackpotAmount').value) || 20000;
  const durationHours = parseFloat(document.getElementById('jackpotDuration').value) || 24;
  try {
    await setDoc(doc(db, 'events', 'jackpot'), {
      active, amount, durationHours, updatedAt: serverTimestamp()
    }, { merge: true });
    showToast('✅ 잭팟 설정이 저장되었습니다.', 'success');
  } catch(e) { showToast('❌ 저장 실패: ' + e.message, 'error'); }
};`;

const replacementHtml = `window.saveJackpotSettings = async function() {
  const active = document.getElementById('jackpotActive').checked;
  const amount = parseFloat(document.getElementById('jackpotAmount').value) || 20000;
  const durationHours = parseFloat(document.getElementById('jackpotDuration').value) || 24;
  try {
    await setDoc(doc(db, 'events', 'jackpot'), {
      active, amount, durationHours, updatedAt: serverTimestamp()
    }, { merge: true });
    showToast('✅ 잭팟 설정이 저장되었습니다.', 'success');
  } catch(e) { showToast('❌ 저장 실패: ' + e.message, 'error'); }
};

window.loadBearMarketSettings = async function() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'bearMarketEvent'));
    if (snap.exists()) {
      const d = snap.data();
      const activeEl = document.getElementById('bearActive');
      if (activeEl) {
        activeEl.checked = !!d.enabled;
        document.getElementById('bearStatusText').textContent = d.enabled ? 'ON' : 'OFF';
        document.getElementById('bearStatusText').style.color = d.enabled ? '#10b981' : '#ef4444';
        document.getElementById('bearTrack').style.background = d.enabled ? '#6366f1' : '#cbd5e1';
        document.getElementById('bearThumb').style.left = d.enabled ? '23px' : '3px';
      }
      if (d.startDate) {
        // convert ISO to datetime-local format (YYYY-MM-DDThh:mm)
        const dObj = new Date(d.startDate);
        dObj.setMinutes(dObj.getMinutes() - dObj.getTimezoneOffset());
        document.getElementById('bearStartDate').value = dObj.toISOString().slice(0,16);
      }
      if (d.endDate) {
        const dObj = new Date(d.endDate);
        dObj.setMinutes(dObj.getMinutes() - dObj.getTimezoneOffset());
        document.getElementById('bearEndDate').value = dObj.toISOString().slice(0,16);
      }
    }
  } catch(e) { console.error('Bear market load error:', e); }
};

window.saveBearMarketSettings = async function() {
  const enabled = document.getElementById('bearActive').checked;
  const startVal = document.getElementById('bearStartDate').value;
  const endVal = document.getElementById('bearEndDate').value;
  
  const startDate = startVal ? new Date(startVal).toISOString() : null;
  const endDate = endVal ? new Date(endVal).toISOString() : null;
  
  try {
    await setDoc(doc(db, 'settings', 'bearMarketEvent'), {
      enabled, startDate, endDate, updatedAt: serverTimestamp()
    }, { merge: true });
    showToast('✅ 하락장 보상 이벤트 설정이 저장되었습니다.', 'success');
  } catch(e) { showToast('❌ 저장 실패: ' + e.message, 'error'); }
};`;

code = code.replace(targetHtml, replacementHtml);

code = code.replace(/else if \(page==='events'\) loadJackpotSettings\(\);/g, "else if (page==='events') { loadJackpotSettings(); loadBearMarketSettings(); }");
code = code.replace(/else if \(firstPage === 'events'\) loadJackpotSettings\(\);/g, "else if (firstPage === 'events') { loadJackpotSettings(); loadBearMarketSettings(); }");

fs.writeFileSync('public/static/admin.html', code);

console.log("JS patched.");
