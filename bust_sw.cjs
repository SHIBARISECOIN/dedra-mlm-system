const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/sw.js', 'utf8');
const v = code.match(/deedra-v(\d+)/);
if (v) {
  const newV = parseInt(v[1]) + 1;
  code = code.replace(`deedra-v${v[1]}`, `deedra-v${newV}`);
  fs.writeFileSync('/home/user/webapp/public/sw.js', code);
  console.log("Updated sw.js to v" + newV);
}
