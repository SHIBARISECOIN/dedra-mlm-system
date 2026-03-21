const fs = require('fs');
const file = '/home/user/webapp/public/index.html';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<button onclick="window\.openGroupChat\(\)"[^>]*>[\s\S]*?<\/button>/, '');

fs.writeFileSync(file, content, 'utf8');
console.log("Group chat removed.");
