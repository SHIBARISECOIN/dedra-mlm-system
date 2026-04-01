const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const oldVersionMatch = html.match(/app\.v3\.js\?v=(\d+)/);
if (oldVersionMatch) {
    const newVersion = Date.now();
    html = html.replace(new RegExp(`app\\.v3\\.js\\?v=${oldVersionMatch[1]}`, 'g'), `app.v3.js?v=${newVersion}`);
    fs.writeFileSync('public/index.html', html);
    console.log('Bumped index.html app.v3.js version to', newVersion);
}
