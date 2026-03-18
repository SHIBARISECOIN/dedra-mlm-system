const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// The issue might be that totalDepMap uses d.id vs d.data().userId improperly.
// Let's check the exact string:
const chunkLoc = appJs.indexOf("const chunks = [];");
console.log(appJs.slice(chunkLoc, chunkLoc + 1500));
