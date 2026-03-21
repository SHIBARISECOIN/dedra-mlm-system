const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

appJs = appJs.replace(/inputCurrency=/g, 'inputMint=');
appJs = appJs.replace(/outputCurrency=/g, 'outputMint=');

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs, 'utf8');
