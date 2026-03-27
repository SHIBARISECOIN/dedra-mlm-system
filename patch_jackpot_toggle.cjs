const fs = require('fs');
let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

const targetStr = `onchange="document.getElementById('jackpotStatusText').textContent=this.checked?'ON':'OFF'; document.getElementById('jackpotStatusText').style.color=this.checked?'#10b981':'#ef4444';"`;

const injection = `onchange="document.getElementById('jackpotStatusText').textContent=this.checked?'ON':'OFF'; document.getElementById('jackpotStatusText').style.color=this.checked?'#10b981':'#ef4444'; document.getElementById('jackpotTrack').style.background=this.checked?'#6366f1':'#cbd5e1'; document.getElementById('jackpotThumb').style.left=this.checked?'23px':'3px';"`;

adminHtml = adminHtml.replace(targetStr, injection);
fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
console.log('Patched jackpot toggle visual logic');
