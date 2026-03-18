const XLSX = require('xlsx');

const workbook = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`Total rows in Excel: ${data.length}`);
for(let i=0; i<3; i++) {
   console.log(data[i]);
}
