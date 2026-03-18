const XLSX = require('xlsx');
const workbook = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

// Find the ID with total investment around 30000
const sums = {};
data.forEach(r => {
  if (!r.member_id) return;
  const count = parseInt(r.order_count) || 1;
  const amt = parseInt(String(r.payment_amount).replace(/,/g, ''), 10);
  sums[r.member_id] = (sums[r.member_id] || 0) + amt;
});

const sorted = Object.entries(sums).sort((a,b) => b[1] - a[1]);
console.log(sorted.slice(0, 10));
