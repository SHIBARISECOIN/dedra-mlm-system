const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("loadTxHistory('all');", "loadTxHistory('deposit');");

fs.writeFileSync(file, content, 'utf8');
console.log("Patched morePage loadTxHistory call.");
