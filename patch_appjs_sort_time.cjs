const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// Fix getSortTime to handle ISO string dates which we just patched to DB today.
const fixGetSortTime = `
    const getSortTime = (item) => {
      if (item.createdAt?.seconds) return item.createdAt.seconds;
      if (typeof item.createdAt?.toMillis === 'function') return item.createdAt.toMillis() / 1000;
      if (typeof item.createdAt === 'string') return new Date(item.createdAt).getTime() / 1000;
      return 0;
    };
`;

code = code.replace(
  /const getSortTime = \(item\) => item\.createdAt\?\.seconds \|\| item\.createdAt\?\.toMillis\?\.\(\) \/ 1000 \|\| 0;/,
  fixGetSortTime
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Patched getSortTime in app.js');
