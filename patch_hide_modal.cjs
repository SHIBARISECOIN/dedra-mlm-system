const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const targetStr = `  if (!data || !data.active) {
    container.innerHTML = '';
    if (jackpotTimerInterval) clearInterval(jackpotTimerInterval);
    return;
  }`;

const injection = `  if (!data || !data.active) {
    container.innerHTML = '';
    if (jackpotTimerInterval) clearInterval(jackpotTimerInterval);
    const m = document.getElementById('jackpotPromoModal');
    if (m) { m.style.display = 'none'; m.classList.add('hidden'); }
    return;
  }`;

appJs = appJs.replace(targetStr, injection);
fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log('Patched modal hiding logic in renderJackpotBanner');
