const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/<script src="\/static\/app\.v3\.js"><\/script>/g, `<script src="/static/app.v3.js?v=${Date.now()}"></script>`);
fs.writeFileSync('public/index.html', html);
console.log('Fixed script tag cache buster');
