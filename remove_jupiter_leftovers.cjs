const fs = require('fs');
let html = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');

html = html.replace(/<div id="jupiter-terminal"[\s\S]*?<\/div>/g, '');
html = html.replace(/<!-- Jupiter Terminal -->/g, '');

fs.writeFileSync('/home/user/webapp/public/index.html', html, 'utf8');
