const fs = require('fs');

let content = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

content = content.replace(
  /return \`<span style="color:#ef4444; font-weight:800;">\+\$\{fmt\(v\)\}<\/span> <span style="color:#ef4444; font-size:12px; display:inline-block; animation: blink 1s infinite; vertical-align:middle;">▲<\/span>\`;/g,
  "return `<span style=\"color:#ef4444; font-weight:800;\">+${fmt(v)} USDT</span> <span style=\"color:#ef4444; font-size:12px; display:inline-block; animation: blink 1s infinite; vertical-align:middle;\">▲</span>`;"
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', content);
console.log("Patched todayEarn in app.js");
