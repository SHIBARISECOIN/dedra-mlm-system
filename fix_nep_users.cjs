const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

// replace (!_nepAllUsers) with (!_nepAllUsers || _nepAllUsers.length === 0)
code = code.replace(/if \(!_nepAllUsers\) \{/g, 'if (!_nepAllUsers || !_nepAllUsers.length) {');
code = code.replace(/_nepAllUsers = \[\];/g, '_nepAllUsers = null;');

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Fixed _nepAllUsers caching');
