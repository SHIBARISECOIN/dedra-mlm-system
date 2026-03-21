const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Regex to capture the exact div block containing the txDateFilter and download button
const filterDivRegex = /<div style="display:flex; gap:8px; margin-top:12px; margin-bottom:12px; align-items:center;">\s*<input type="date" id="txDateFilter"[^>]*>\s*<button onclick="downloadTxHistory\(\)"[^>]*>\s*<i class="fas fa-download"><\/i> 다운로드\s*<\/button>\s*<\/div>/g;

html = html.replace(filterDivRegex, '');

fs.writeFileSync(indexHtmlPath, html);
console.log('Removed download button and date filter from index.html.');
