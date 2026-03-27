const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

code = code.replace(
  "    const now = Date.now();",
  "    const now = Date.now();\n    if (c.req.query('nocache') === '1') _newsCache = null;"
);

fs.writeFileSync('src/index.tsx', code);
console.log('patched nocache');
