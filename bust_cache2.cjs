const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

const now = Date.now();

code = code.replace(/\?v=\d+/g, `?v=${now}`);

fs.writeFileSync('public/index.html', code);
console.log(`Updated ALL cache busters to v=${now} in index.html!`);
