const fs = require('fs');
const ts = Date.now();
let code = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');
code = code.replace(/\/static\/app\.js\?v=\d+/g, `/static/app.js?v=${ts}`);
fs.writeFileSync('/home/user/webapp/public/index.html', code);
console.log("Busted cache in public/index.html with ts: " + ts);
