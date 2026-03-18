const XLSX = require('xlsx');
const workbook = XLSX.readFile('/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260319_0326.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);
const target = data.filter(r => r.purchase_date && String(r.purchase_date).startsWith('2026-03-0'));
console.log(JSON.stringify(target, null, 2));
