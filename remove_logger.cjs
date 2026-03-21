const fs = require('fs');
let html = fs.readFileSync('public/static/admin.html', 'utf8');
const scriptRegex = /<script>\s*window\.addEventListener\('error'[\s\S]*?<\/script>\s*/;
html = html.replace(scriptRegex, '');
fs.writeFileSync('public/static/admin.html', html);

let tsx = fs.readFileSync('src/index.tsx', 'utf8');
const endpointRegex = /app\.post\('\/api\/admin\/log-error'[\s\S]*?\}\);\n/;
tsx = tsx.replace(endpointRegex, '');
fs.writeFileSync('src/index.tsx', tsx);
