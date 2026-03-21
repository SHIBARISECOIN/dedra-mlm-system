const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

appJs = appJs.replace(/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/g, 'DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv');

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs, 'utf8');
console.log('DDRA mint address fixed in app.js');
