const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public/static/app.js');
let js = fs.readFileSync(appJsPath, 'utf8');

js = js.replace(/window\.animateValue\(document\.getElementById\('totalAsset'\), 0, total, 1500/g, 
  "const el = document.getElementById('totalAsset'); const start = parseFloat(el.getAttribute('data-last')) || 0; el.setAttribute('data-last', total); window.animateValue(el, start, total, 800");

js = js.replace(/window\.animateValue\(splitUsdtEl, 0, lockedUsdt, 1500/g,
  "const start = parseFloat(splitUsdtEl.getAttribute('data-last')) || 0; splitUsdtEl.setAttribute('data-last', lockedUsdt); window.animateValue(splitUsdtEl, start, lockedUsdt, 800");

js = js.replace(/window\.animateValue\(splitUsdtBalanceEl, 0, usdt, 1500/g,
  "const start = parseFloat(splitUsdtBalanceEl.getAttribute('data-last')) || 0; splitUsdtBalanceEl.setAttribute('data-last', usdt); window.animateValue(splitUsdtBalanceEl, start, usdt, 800");

fs.writeFileSync(appJsPath, js);
console.log('Fixed animateValue jumping in updateHomeUI');
