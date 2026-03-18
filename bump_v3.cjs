const fs = require('fs');
const file = '/home/user/webapp/public/index.html';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/app\.js\?v=(\d+)/g, (match, v) => `app.js?v=${parseInt(v) + 1}`);
fs.writeFileSync(file, content);
