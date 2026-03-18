const XLSX = require('xlsx');

const workbook = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`Total rows in Excel: ${data.length}`);

let mismatchCount = 0;

for (let i = 0; i < Math.min(data.length, 5); i++) {
  const row = data[i];
  console.log(`User: ${row['userid']}, Package: ${row['packagename']}, Invest: ${row['investment-amount']}, Rate: ${row['interest-rate']}, Date: ${row['PurchaseDate']}`);
}
