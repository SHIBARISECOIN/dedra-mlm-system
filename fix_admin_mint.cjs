const fs = require('fs');
let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

adminHtml = adminHtml.replace(/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/g, 'DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv');

fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml, 'utf8');
console.log('DDRA mint address fixed in admin.html');
