const XLSX = require('xlsx');
const workbook = XLSX.readFile('/home/user/uploaded_files/member_info.xls');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

// Let's print members with large deposits or matching the criteria
console.log("Total members in member_info.xls:", data.length);
console.log("Sample:", data.slice(0, 2));

const early = data.filter(r => {
  const d = String(r['가입일'] || r['등록일'] || r.join_date || r.date || '');
  return d.includes('03-04') || d.includes('03-05') || d.includes('03-06') || d.includes('03/04') || d.includes('03/05');
});

console.log("Early members count:", early.length);
