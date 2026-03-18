const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`    if (childrenWrap) childrenWrap.innerHTML = '<div style="color:red;padding:20px;">' + err.message + '</div>';
    if (childrenWrap) childrenWrap.innerHTML = '<div style="color:#ef4444;font-size:13px;">데이터를 불러오지 못했습니다.</div>';`,
`    if (childrenWrap) childrenWrap.innerHTML = '<div style="color:#ef4444;font-size:13px;">데이터를 불러오지 못했습니다. (' + err.message + ')</div>';`
);

fs.writeFileSync(file, code);
