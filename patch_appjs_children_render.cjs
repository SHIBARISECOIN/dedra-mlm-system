const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// The original check "currentDepth < fetchDepth" is still limiting how much we render.
// Since we now fetch everything up to fetchDepth in the children array structure,
// we should just let it render everything it fetched.

code = code.replace(
  /if \(n\.children && n\.children\.length > 0 && currentDepth < fetchDepth\)/,
  "if (n.children && n.children.length > 0)"
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Patched user app children render condition');
