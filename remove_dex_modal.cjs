const fs = require('fs');
let html = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');

// Replace dexModal entirely
html = html.replace(/<div id="dexModal" class="modal hidden">[\s\S]*?<!-- 자동 복리 동의 모달 -->/, '<!-- 자동 복리 동의 모달 -->');

fs.writeFileSync('/home/user/webapp/public/index.html', html, 'utf8');
console.log('dexModal removed');
