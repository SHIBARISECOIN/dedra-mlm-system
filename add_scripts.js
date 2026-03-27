const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('/home/user/webapp/package.json', 'utf8'));
if (!pkg.scripts) {
  pkg.scripts = {};
}
pkg.scripts.build = "vite build";
pkg.scripts.deploy = "npm run build && wrangler pages deploy dist --project-name deedra";
fs.writeFileSync('/home/user/webapp/package.json', JSON.stringify(pkg, null, 2));
