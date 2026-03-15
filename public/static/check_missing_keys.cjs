const fs = require('fs');

const appJsPath = '/home/user/webapp/public/static/app.js';
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Extract all translation keys from ko: { ... } in app.js
const koMatch = appJsContent.match(/ko:\s*\{([\s\S]*?)\n  \},/);
let existingKeys = new Set();
if (koMatch) {
  const lines = koMatch[1].split('\n');
  for (let line of lines) {
    const match = line.match(/^\s*([a-zA-Z0-9_]+):/);
    if (match) existingKeys.add(match[1]);
  }
}

// Get all keys from index.html
const indexHtmlContent = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');
const regex = /data-i18n="([^"]+)"/g;
let match;
let missingKeys = new Set();

while ((match = regex.exec(indexHtmlContent)) !== null) {
  const key = match[1];
  if (!existingKeys.has(key)) {
    missingKeys.add(key);
  }
}

// Also check missing keys that are called dynamically like t('...')
const tRegex = /t\(['"]([^'"]+)['"]\)/g;
while ((match = tRegex.exec(appJsContent)) !== null) {
  const key = match[1];
  if (!existingKeys.has(key)) {
    missingKeys.add(key);
  }
}

console.log("Missing keys:", Array.from(missingKeys).sort());
