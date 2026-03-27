const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const ts = Date.now();
html = html.replace(/<script type="module" src="\/static\/firebase\.v3\.js"><\/script>/g, `<script type="module" src="/static/firebase.v3.js?v=${ts}"></script>`);
html = html.replace(/<script src="\/static\/js\/chat\.js"><\/script>/g, `<script src="/static/js/chat.js?v=${ts}"></script>`);
html = html.replace(/<link rel="stylesheet" href="\/static\/style\.v3\.css" \/>/g, `<link rel="stylesheet" href="/static/style.v3.css?v=${ts}" />`);
fs.writeFileSync('public/index.html', html);
console.log('Fixed more script tags cache buster');
