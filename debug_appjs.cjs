const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// The issue might be that totalDepMap uses d.id vs d.data().userId improperly.
// Let's check the exact string:
const m = appJs.match(/totalDepMap\[d\.data\(\)\.userId \|\| d\.id\] = \(d\.data\(\)\.lockedBalance \|\| 0\);/);
console.log("Match:", m);
