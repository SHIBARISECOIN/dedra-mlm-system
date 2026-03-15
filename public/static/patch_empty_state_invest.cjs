const fs = require('fs');

const appPath = '/home/user/webapp/public/static/app.js';
let appContent = fs.readFileSync(appPath, 'utf8');

appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-receipt"></i><br>거래 내역이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-receipt"></i><br>${t(\'emptyTx\')}</div>'
);

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('Fixed final empty states');
