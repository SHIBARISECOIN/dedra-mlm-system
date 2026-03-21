const fs = require('fs');
const file = '/home/user/webapp/src/index.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const rssUrl = 'https://www.blockmedia.co.kr/feed';", "const rssUrl = 'https://kr.cointelegraph.com/rss';");

fs.writeFileSync(file, content, 'utf8');
console.log("News URL fixed");
