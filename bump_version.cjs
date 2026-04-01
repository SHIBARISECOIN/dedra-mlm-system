const fs = require('fs');
const indexFile = './public/index.html';
let content = fs.readFileSync(indexFile, 'utf8');
const newVersion = Date.now();
content = content.replace(/app\.v3\.js\?v=\d+/g, `app.v3.js?v=${newVersion}`);
fs.writeFileSync(indexFile, content);
console.log('Version bumped to', newVersion);
