const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');
code = code.replace('\n});\n\napp.get(\'/admin\'', '\napp.get(\'/admin\'');
fs.writeFileSync('src/index.tsx', code);
