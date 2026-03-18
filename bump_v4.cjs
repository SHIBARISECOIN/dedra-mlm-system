const fs = require('fs');
const files = ['/home/user/webapp/public/index.html', '/home/user/webapp/dist/index.html'];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/app\.js\?v=(\d+)/g, (match, v) => `app.js?v=${parseInt(v) + 1}`);
  fs.writeFileSync(file, content);
});
