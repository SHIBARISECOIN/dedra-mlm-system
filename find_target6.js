const XLSX = require('xlsx');
const workbook = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

// Let's print the maximum order_count or payment_amount
let max = 0;
data.forEach(r => {
  const amt = parseInt(String(r.payment_amount).replace(/,/g, ''), 10);
  if (amt > max) max = amt;
});
console.log('Max payment_amount:', max);

let maxCount = 0;
data.forEach(r => {
  const c = parseInt(String(r.order_count).replace(/,/g, ''), 10);
  if (c > maxCount) maxCount = c;
});
console.log('Max order_count:', maxCount);

// Find members who joined Mar 4-6
const early = data.filter(r => {
  const d = String(r.purchase_date);
  return d.startsWith('2026-03-04') || d.startsWith('2026-03-05') || d.startsWith('2026-03-06');
});
console.log('Early members (Mar 4-6) count:', early.length);
console.log('Sample of early members:', early.slice(0, 5));
