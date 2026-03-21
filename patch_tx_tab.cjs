const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "async function loadTxHistory(typeFilter = window.currentTxTab) {",
  "async function loadTxHistory(typeFilter = window.currentTxTab) {\n  if (typeFilter === 'roi') typeFilter = 'invest';"
);

fs.writeFileSync(file, content);
console.log("Patched tx tab");
