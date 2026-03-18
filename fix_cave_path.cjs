const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`      name: userData?.name || '나',`,
`      name: userData?.name || '나',
      username: userData?.username || '',
      email: userData?.email || '',`
);

fs.writeFileSync(file, code);
console.log('Fixed cavePath initialization');
