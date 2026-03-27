const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const targetStr = `const originalApplyLang = window.applyLang;
window.applyLang = function() {
    if (originalApplyLang) originalApplyLang();
    const gBtn = document.getElementById('guideFloatText');
    if (gBtn) {
        const lang = window.currentLang || 'ko';
        gBtn.innerText = tutI18n[lang]?.btn || tutI18n['ko'].btn;
    }
};`;
const injection = `const originalApplyLang = window.applyLang;
window.applyLang = function() {
    if (originalApplyLang) originalApplyLang();
    const lang = window.currentLang || 'ko';
    const text = tutI18n[lang]?.btn || tutI18n['ko'].btn;
    const gBtn = document.getElementById('guideFloatText');
    if (gBtn) gBtn.innerText = text;
    const mBtn = document.getElementById('depModalGuideText');
    if (mBtn) mBtn.innerText = text;
};`;

if (appJs.includes(targetStr)) {
  appJs = appJs.replace(targetStr, injection);
  fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
  console.log('Patched applyLang hook for modal button');
} else {
  console.log('Target string not found in app.js for applyLang');
}
