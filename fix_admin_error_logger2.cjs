const fs = require('fs');
let html = fs.readFileSync('public/static/admin.html', 'utf8');

html = html.replace("fetch('/api/admin/log-error', {", "console.error('Captured error info: line=' + e.lineno + ' col=' + e.colno + ' msg=' + e.message); fetch('/api/admin/log-error', {");
fs.writeFileSync('public/static/admin.html', html);
console.log("Updated logger.");
