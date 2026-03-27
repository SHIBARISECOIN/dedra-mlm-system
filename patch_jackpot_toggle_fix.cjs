const fs = require('fs');
let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

const targetStr = `<div id="jackpotTrack" style="position:absolute;inset:0;background:#cbd5e1;border-radius:13px;transition:.3s;cursor:pointer;" onclick="document.getElementById('jackpotActive').click()"></div>`;
const injection = `<div id="jackpotTrack" style="position:absolute;inset:0;background:#cbd5e1;border-radius:13px;transition:.3s;cursor:pointer;pointer-events:none;"></div>`;

if (adminHtml.includes(targetStr)) {
  adminHtml = adminHtml.replace(targetStr, injection);
  fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
  console.log('Fixed double-click issue on jackpot toggle');
} else {
  console.log('Target string not found. Trying regex...');
  const rx = /<div id="jackpotTrack" [^>]*onclick="document.getElementById\('jackpotActive'\)\.click\(\)"[^>]*><\/div>/;
  if (rx.test(adminHtml)) {
    adminHtml = adminHtml.replace(rx, '<div id="jackpotTrack" style="position:absolute;inset:0;background:#cbd5e1;border-radius:13px;transition:.3s;cursor:pointer;pointer-events:none;"></div>');
    fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
    console.log('Fixed double-click issue using regex');
  } else {
    console.log('Regex also failed to find the target.');
  }
}
