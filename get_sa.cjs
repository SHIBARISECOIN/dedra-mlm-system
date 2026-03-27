const fs = require('fs');
const code = fs.readFileSync('src/index.tsx', 'utf8');
const match = code.match(/const SERVICE_ACCOUNT = ({[\s\S]+?});/);
if (match) {
  let sa = match[1];
  console.log(sa);
}
