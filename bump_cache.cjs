const fs = require('fs');

let html = fs.readFileSync('/home/user/webapp/public/index.html', 'utf-8');
const ts = Date.now();

// Replace app.js version
html = html.replace(/src="\/static\/app\.js\?v=\d+"/g, `src="/static/app.js?v=${ts}"`);

// Replace style.css version
html = html.replace(/href="\/static\/style\.css\?v=\d+"/g, `href="/static/style.css?v=${ts}"`);

fs.writeFileSync('/home/user/webapp/public/index.html', html);
console.log(`Bumped cache in index.html to v=${ts}`);
