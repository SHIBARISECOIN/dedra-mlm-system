const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

code = code.replace(/(\s*)(statusRejected: '거부됨',)/, "$1statusHeld: '보류중',$1$2");
code = code.replace(/(\s*)(statusRejected: 'Rejected',)/, "$1statusHeld: 'Held',$1$2");
code = code.replace(/(\s*)(statusRejected: 'Đã từ chối',)/, "$1statusHeld: 'Đang giữ',$1$2");
code = code.replace(/(\s*)(statusRejected: 'ถูกปฏิเสธ',)/, "$1statusHeld: 'ถูกระงับ',$1$2");

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
