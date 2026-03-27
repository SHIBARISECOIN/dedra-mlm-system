const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const targetStr = `guideBtn.style.display = hasDep ? 'none' : 'flex';`;
const injection = `guideBtn.style.display = 'none'; // Disabled by request`;

if (appJs.includes(targetStr)) {
  appJs = appJs.replace(targetStr, injection);
  fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
  console.log('Patched guideFloatBtn logic in app.js');
} else {
  console.log('Target string not found in app.js');
}
