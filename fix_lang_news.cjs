const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// Replace window.currentLang with currentLang in news functions
code = code.replace(/window\.currentLang/g, 'currentLang');

fs.writeFileSync('public/static/app.js', code);
console.log("Patched window.currentLang to currentLang");
