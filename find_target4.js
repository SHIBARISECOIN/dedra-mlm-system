const XLSX = require('xlsx');
const workbook = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

// Find the ID with total investment around 30000
const sums = {};
data.forEach(r => {
  if (!r.member_id) return;
  const amt = String(r.payment_amount).replace(/,/g, '');
  const count = parseInt(r.order_count) || 1;
  const total = parseInt(amt, 10) * count;
  sums[r.member_id] = (sums[r.member_id] || 0) + total;
});

for (let id in sums) {
  if (sums[id] >= 30000) {
    console.log(`Found: ${id} with ${sums[id]}`);
    console.log(data.filter(r => r.member_id === id));
  }
}
