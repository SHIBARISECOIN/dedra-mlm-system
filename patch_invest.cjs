const fs = require('fs');
const path = require('path');
const file = path.join('/home/user/webapp', 'public/static/app.js');
let code = fs.readFileSync(file, 'utf8');

// Replace 1: normal invest
const search1 = "productName: selectedProduct.name, amount,";
const replace1 = "productName: selectedProduct.name, amount, amountUsdt: amount,";
if (code.includes(search1)) {
  code = code.replace(search1, replace1);
  console.log("Patched normal invest");
} else {
  console.log("Could not find normal invest search string");
}

// Replace 2: reinvest
const search2 = "amount: inputAmt,";
const replace2 = "amount: inputAmt, amountUsdt: inputAmt,";
if (code.includes(search2)) {
  code = code.replace(search2, replace2);
  console.log("Patched reinvest");
} else {
  console.log("Could not find reinvest search string");
}

fs.writeFileSync(file, code);
console.log("App patched.");
