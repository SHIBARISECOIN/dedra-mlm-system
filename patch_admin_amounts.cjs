const fs = require('fs');

let content = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

// Replace b.amount || 0 with b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)
content = content.replace(/b\.amount\s*\|\|\s*0/g, "b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)");

// Replace b.amount in template strings where it's formatted
content = content.replace(/fmt4\(b\.amount\)/g, "fmt4(b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0))");

fs.writeFileSync('/home/user/webapp/public/static/admin.html', content);
console.log("Patched admin.html amounts");
