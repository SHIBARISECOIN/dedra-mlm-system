const fs = require('fs');
let html = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');

html = html.replace(/translateX\(26px\);/g, 'translateX(26px) !important;');

fs.writeFileSync('/home/user/webapp/public/index.html', html, 'utf8');
