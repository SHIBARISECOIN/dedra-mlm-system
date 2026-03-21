const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

const timestamp = Date.now();

// Replace app.js and css with versioned ones
html = html.replace(/src="\/static\/app\.js(\?v=\d+)?"/, `src="/static/app.js?v=${timestamp}"`);
html = html.replace(/href="\/static\/style\.css(\?v=\d+)?"/, `href="/static/style.css?v=${timestamp}"`);

fs.writeFileSync(indexHtmlPath, html);
console.log('Added version query param to static assets in index.html');
