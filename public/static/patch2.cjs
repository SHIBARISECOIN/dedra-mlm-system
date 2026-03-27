const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// remove duplicate insertions
code = code.replace(/    statusActive: 'Active',\n    statusEnded: 'Ended',\n    statusActive: '진행중',\n    statusEnded: '종료',\n/g, '');
code = code.replace(/    statusActive: '진행중',\n    statusEnded: '종료',\n/g, '');
code = code.replace(/    statusActive: 'Active',\n    statusEnded: 'Ended',\n/g, '');

// now insert properly
code = code.replace(/(\s*)(statusPending: '승인 대기',)/, "$1statusActive: '진행중',$1statusEnded: '종료',$1$2");
code = code.replace(/(\s*)(statusPending: 'Pending',)/, "$1statusActive: 'Active',$1statusEnded: 'Ended',$1$2");
code = code.replace(/(\s*)(statusPending: 'Chờ duyệt',)/, "$1statusActive: 'Đang hoạt động',$1statusEnded: 'Đã kết thúc',$1$2");
code = code.replace(/(\s*)(statusPending: 'รอดำเนินการ',)/, "$1statusActive: 'กำลังใช้งาน',$1statusEnded: 'สิ้นสุด',$1$2");

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
