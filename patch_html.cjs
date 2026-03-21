const fs = require('fs');
let html = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');

// 1. Fix banner
html = html.replace(/\/static\/img\/main-banner\.png/g, '/static/logo-banner.png');

// 2. Remove network earnings preview
html = html.replace(/<!-- 네트워크 수익 미리보기 -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<!-- ======== INVEST 페이지 ======== -->/, '</div>\n      </div>\n\n      <!-- ======== INVEST 페이지 ======== -->');

fs.writeFileSync('/home/user/webapp/public/index.html', html, 'utf8');
console.log('HTML patched!');
