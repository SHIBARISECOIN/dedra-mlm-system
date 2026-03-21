const fs = require('fs');
let html = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');

html = html.replace(/#autoCompoundSwitch:checked \+ \.slider \{ background-color: #10b981; \}/g, '#autoCompoundSwitch:checked + .slider { background-color: #10b981 !important; }');

fs.writeFileSync('/home/user/webapp/public/index.html', html, 'utf8');
console.log('Slider CSS fixed');
