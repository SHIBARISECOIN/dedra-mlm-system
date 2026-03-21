const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/static/app.js');
let js = fs.readFileSync(filePath, 'utf8');

// Replace the last occurrences of downloadTxHistory
const regex = /window\.downloadTxHistory = function\(\)\s*\{[\s\S]*?\}\s*;\s*$/m;
// Let's just remove the block if we find it at the end of the file.
// Or more safely:
const startIdx = js.lastIndexOf('window.downloadTxHistory = function()');
if (startIdx > 4044) { // Only if it's the second one
  const endIdx = js.indexOf('};', startIdx) + 2;
  if (endIdx > startIdx) {
    js = js.substring(0, startIdx) + js.substring(endIdx);
    fs.writeFileSync(filePath, js);
    console.log('Removed duplicate downloadTxHistory.');
  }
}

// And fix the dataset.filter fallbacks
js = js.replace(/loadTxHistory\(activeTab \? activeTab\.dataset\.filter : 'all'\)/g, "loadTxHistory(window.currentTxTab || 'deposit')");

fs.writeFileSync(filePath, js);
console.log('Updated app.js');
