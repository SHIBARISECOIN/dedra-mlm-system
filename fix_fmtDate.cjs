const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');
code = code.replace("window.fmtDate(r.createdAt)", "window.fmtDate ? window.fmtDate(r.createdAt) : (r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000).toLocaleString('ko') : '-')");
fs.writeFileSync('/home/user/webapp/public/static/admin.html', code);
console.log("fmtDate patched");
