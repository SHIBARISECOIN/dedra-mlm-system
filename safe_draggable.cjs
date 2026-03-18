const fs = require('fs');
const files = ['/home/user/webapp/public/static/app.js', '/home/user/webapp/dist/static/app.js'];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    'if (wrap) { window.makeDraggableMap(wrap, treeEl); }',
    'if (wrap) { try { window.makeDraggableMap(wrap, treeEl); } catch(e) { console.error(e); } }'
  );
  fs.writeFileSync(file, content);
});
