const fs = require('fs');
const file = '/home/user/webapp/src/index.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const linkMatch = itemStr.match\(\/<link>\(\[\\s\\S\]\*\?\)<\\\/link>\/\);/g,
  "const linkMatch = itemStr.match(/<link><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/link>/) || itemStr.match(/<link>([\\s\\S]*?)<\\/link>/);"
);

fs.writeFileSync(file, content, 'utf8');
console.log("CDATA Link fixed");
