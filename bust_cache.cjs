const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

const now = Date.now();

code = code.replace(/app\.js\?v=\d+/g, `app.js?v=${now}`);
code = code.replace(/firebase\.js\?v=\d+/g, `firebase.js?v=${now}`);
code = code.replace(/style\.css\?v=\d+/g, `style.css?v=${now}`);
code = code.replace(/i18n\.js\?v=\d+/g, `i18n.js?v=${now}`);

fs.writeFileSync('public/index.html', code);
console.log(`Updated cache busters to v=${now} in index.html!`);
