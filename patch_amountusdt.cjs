const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace usages where it falls back to b.amount 
  content = content.replace(/b\.amountUsdt\s*\|\|\s*b\.amount\s*\|\|\s*0/g, "b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)");
  content = content.replace(/b\.amountUsdt\s*\|\|\s*b\.amount/g, "b.amountUsdt !== undefined ? b.amountUsdt : b.amount");

  // In specific places like actualRoi += (b.amount || 0); we should replace it to prefer amountUsdt
  // For `actualRoi += (b.amount || 0);`
  content = content.replace(/actualRoi\s*\+=\s*\(b\.amount\s*\|\|\s*0\);/g, "actualRoi += (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0));");
  
  // For `otherBonuses += (b.amount || 0);`
  content = content.replace(/otherBonuses\s*\+=\s*\(b\.amount\s*\|\|\s*0\);/g, "otherBonuses += (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0));");

  // For `dailyMap\[dateStr\] \+= \(b\.amount \|\| 0\);`
  content = content.replace(/dailyMap\[dateStr\]\s*\+=\s*\(b\.amount\s*\|\|\s*0\);/g, "dailyMap[dateStr] += (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0));");

  // For txList rendering `tx.amount = tx.amountUsdt || tx.amount || 0;`
  content = content.replace(/tx\.amount\s*=\s*tx\.amountUsdt\s*\|\|\s*tx\.amount\s*\|\|\s*0;/g, "tx.amount = tx.amountUsdt !== undefined ? tx.amountUsdt : (tx.amount || 0);");

  // In `admin.html`
  content = content.replace(/\(r\.amountUsdt\|\|r\.amount\|\|0\)/g, "(r.amountUsdt !== undefined ? r.amountUsdt : (r.amount||0))");

  fs.writeFileSync(file, content);
  console.log("Patched " + file);
}

patchFile('/home/user/webapp/public/static/app.js');
patchFile('/home/user/webapp/public/static/admin.html');
