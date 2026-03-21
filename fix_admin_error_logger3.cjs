const fs = require('fs');
let html = fs.readFileSync('public/static/admin.html', 'utf8');

html = html.replace("console.error('Captured error info: line=' + e.lineno + ' col=' + e.colno + ' msg=' + e.message);", "console.error('Captured error info: file=' + e.filename + ' line=' + e.lineno + ' col=' + e.colno + ' msg=' + e.message);");
fs.writeFileSync('public/static/admin.html', html);
console.log("Updated logger.");
