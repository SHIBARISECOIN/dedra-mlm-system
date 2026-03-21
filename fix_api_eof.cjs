const fs = require('fs');
let code = fs.readFileSync('public/static/js/api.js', 'utf8');
if (code.endsWith('\\n}')) {
  code = code.slice(0, -3) + '\n}';
  fs.writeFileSync('public/static/js/api.js', code);
  console.log("Fixed public api.js");
}
