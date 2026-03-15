const fs = require('fs');

// Patch app.js 
const appPath = '/home/user/webapp/public/static/app.js';
let appContent = fs.readFileSync(appPath, 'utf8');

// Remove duplicate keys that were added by my script by overwriting the whole TRANSLATIONS dict for a moment.
// Actually simpler to just replace "나의 FREEZE 내역" with "📋 내 FREEZE 현황" where it appears without emoji
appContent = appContent.replace(/myInvestTitle: '나의 FREEZE 내역',/g, '');
appContent = appContent.replace(/myInvestTitle: 'My FREEZE History',/g, '');
appContent = appContent.replace(/myInvestTitle: 'Lịch sử FREEZE',/g, '');
appContent = appContent.replace(/myInvestTitle: 'ประวัติ FREEZE ของฉัน',/g, '');

// Save app.js
fs.writeFileSync(appPath, appContent, 'utf8');

console.log('Fixed duplicate keys');
