const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// Also check how totalDepMap is used
const useLoc = appJs.indexOf("const totalSales = Object.values(totalDepMap).reduce");
console.log(appJs.slice(useLoc - 500, useLoc + 500));
