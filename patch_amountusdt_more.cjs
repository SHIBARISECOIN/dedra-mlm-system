const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace data.amountUsdt || data.amount || 0
  content = content.replace(/data\.amountUsdt\s*\|\|\s*data\.amount\s*\|\|\s*0/g, "data.amountUsdt !== undefined ? data.amountUsdt : (data.amount || 0)");
  content = content.replace(/inv\.amountUsdt\s*\|\|\s*inv\.amount/g, "inv.amountUsdt !== undefined ? inv.amountUsdt : inv.amount");

  fs.writeFileSync(file, content);
  console.log("Patched " + file);
}

patchFile('/home/user/webapp/public/static/app.js');
