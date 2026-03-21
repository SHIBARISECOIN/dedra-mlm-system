const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/showModal\('autoCompoundModal'\);/g, "document.getElementById('autoCompoundModal').classList.remove('hidden');");

fs.writeFileSync(file, content, 'utf8');
console.log("AutoCompound modal fix applied.");
