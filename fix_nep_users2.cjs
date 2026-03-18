const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

code = code.replace(/const allUsers = _nepAllUsers;/g, 'const allUsers = _nepAllUsers || [];');

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Fixed allUsers fallback');
