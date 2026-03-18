const fs = require('fs');
const path = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(path, 'utf8');

// Add translation keys for investments
const keys = {
  ko: `
    myInvestTitle: '나의 FREEZE 내역',
    emptyInvest: '진행 중인 FREEZE가 없습니다',
    dailyReturnLabel: '❄️ 일 수익:',
    remainDaysLabel: '잔여 {n}일',
    totalExpectedLabel: '총 예상수익(일): +{n} USDT (원금은 만기 후 출금 가능)',
    investUnit: '건',
    perDay: '/일',
    productMonth1: '1개월',
    productMonth3: '3개월',
    productMonth6: '6개월',
    productMonth12: '12개월',
  `,
  en: `
    myInvestTitle: 'My FREEZE History',
    emptyInvest: 'No active FREEZE found',
    dailyReturnLabel: '❄️ Daily Return:',
    remainDaysLabel: '{n} days left',
    totalExpectedLabel: 'Total Expected/Day: +{n} USDT (Principal withdrawable at maturity)',
    investUnit: ' items',
    perDay: '/day',
    productMonth1: '1 Month',
    productMonth3: '3 Months',
    productMonth6: '6 Months',
    productMonth12: '12 Months',
  `,
  vi: `
    myInvestTitle: 'Lịch sử FREEZE',
    emptyInvest: 'Không có FREEZE nào đang hoạt động',
    dailyReturnLabel: '❄️ Lợi nhuận hàng ngày:',
    remainDaysLabel: 'Còn lại {n} ngày',
    totalExpectedLabel: 'Tổng dự kiến/ngày: +{n} USDT (Gốc có thể rút khi đáo hạn)',
    investUnit: ' mục',
    perDay: '/ngày',
    productMonth1: '1 Tháng',
    productMonth3: '3 Tháng',
    productMonth6: '6 Tháng',
    productMonth12: '12 Tháng',
  `,
  th: `
    myInvestTitle: 'ประวัติ FREEZE ของฉัน',
    emptyInvest: 'ไม่พบ FREEZE ที่กำลังใช้งาน',
    dailyReturnLabel: '❄️ ผลตอบแทนรายวัน:',
    remainDaysLabel: 'เหลือ {n} วัน',
    totalExpectedLabel: 'คาดการณ์รวม/วัน: +{n} USDT (ถอนเงินต้นได้เมื่อครบกำหนด)',
    investUnit: ' รายการ',
    perDay: '/วัน',
    productMonth1: '1 เดือน',
    productMonth3: '3 เดือน',
    productMonth6: '6 เดือน',
    productMonth12: '12 เดือน',
  `
};

for (const lang of ['ko', 'en', 'vi', 'th']) {
  const searchStr = '  ' + lang + ': {';
  const replaceStr = searchStr + '\\n' + keys[lang];
  content = content.replace(searchStr, replaceStr);
}

// Translate product list UI
content = content.replace(
  "return `\n      <div class=\"product-card\" onclick=\"openInvestModal('${p.id}', '${p.name}', ${p.roiPercent}, ${p.durationDays}, ${p.minAmount}, ${p.maxAmount})\">\n        <div class=\"product-header\">\n          <span class=\"product-name\">${p.name}</span>\n          <span class=\"product-roi\">${p.roiPercent}%</span>\n        </div>\n        <div style=\"font-size:10px;text-align:right;color:var(--text2);margin-top:-6px;margin-bottom:8px;\">ROI 일일</div>",
  "return `\n      <div class=\"product-card\" onclick=\"openInvestModal('${p.id}', '${p.name}', ${p.roiPercent}, ${p.durationDays}, ${p.minAmount}, ${p.maxAmount})\">\n        <div class=\"product-header\">\n          <span class=\"product-name\">${t(p.name === '1개월' ? 'productMonth1' : p.name === '3개월' ? 'productMonth3' : p.name === '6개월' ? 'productMonth6' : p.name === '12개월' ? 'productMonth12' : p.name)}</span>\n          <span class=\"product-roi\">${p.roiPercent}%</span>\n        </div>\n        <div style=\"font-size:10px;text-align:right;color:var(--text2);margin-top:-6px;margin-bottom:8px;\">${t('dailyRoi') || 'ROI 일일'}</div>"
);

// Translate invest items
content = content.replace(
  /<div class="empty-state"><i class="fas fa-snowflake"><\/i>진행 중인 FREEZE가 없습니다<\/div>/g,
  '<div class="empty-state"><i class="fas fa-snowflake"></i>${t(\'emptyInvest\')}</div>'
);

content = content.replace(
  /setEl\('activeInvestCount', sumItems.count \+ '건'\);/g,
  "setEl('activeInvestCount', sumItems.count + (t('investUnit') || '건'));"
);

content = content.replace(
  /setEl\('expectedReturn', fmt\(sumItems.returns\) \+ ' USDT\/일'\);/g,
  "setEl('expectedReturn', fmt(sumItems.returns) + ' USDT' + (t('perDay') || '/일'));"
);

content = content.replace(
  /<span>❄️ 일 수익: <strong style="color:var\(--green\)">\+\$\$\{fmt\(dailyD\)\}<\/strong> \(\$\{\(dailyRoiRate\*100\)\.toFixed\(2\)\}%\/일\)<\/span>/g,
  "<span>${t('dailyReturnLabel')} <strong style=\"color:var(--green)\">+$${fmt(dailyD)}</strong> (${(dailyRoiRate*100).toFixed(2)}%${t('perDay')})</span>"
);

content = content.replace(
  /<span>잔여 \$\{remainDays\}일<\/span>/g,
  "<span>${t('remainDaysLabel').replace('{n}', remainDays)}</span>"
);

content = content.replace(
  /총 예상수익\(일\): \+\$\{fmt\(inv\.expectedReturn \|\| 0\)\} USDT \(원금은 만기 후 출금 가능\)/g,
  "${t('totalExpectedLabel').replace('{n}', fmt(inv.expectedReturn || 0))}"
);

// Format product name in invest list
content = content.replace(
  /<span class="invest-item-name">\$\{inv\.productName \|\| 'FREEZE'\}<\/span>/g,
  "<span class=\"invest-item-name\">${t(inv.productName === '1개월' ? 'productMonth1' : inv.productName === '3개월' ? 'productMonth3' : inv.productName === '6개월' ? 'productMonth6' : inv.productName === '12개월' ? 'productMonth12' : (inv.productName || 'FREEZE'))}</span>"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched investments logic');
