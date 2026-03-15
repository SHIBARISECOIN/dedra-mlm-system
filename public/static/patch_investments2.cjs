const fs = require('fs');

const appPath = '/home/user/webapp/public/static/app.js';
let appContent = fs.readFileSync(appPath, 'utf8');

// Also fix product-conversion logic where dynamic HTML is
appContent = appContent.replace(
  "❄️ ${fmt(p.minAmount)} USDT FREEZE 시 일 수익 <strong>~${fmt(dailyEarning)} USDT</strong>",
  "❄️ ${t('productHint1').replace('{min}', fmt(p.minAmount))} <strong>~${fmt(dailyEarning)} USDT</strong>"
);
appContent = appContent.replace(
  "(≈ ${fmt(dailyEarning / (deedraPrice||0.5))} DDRA/일) · 🔒 만기 후 언프리즈 가능",
  "(≈ ${fmt(dailyEarning / (deedraPrice||0.5))} DDRA${t('perDay')}) · 🔒 ${t('productHint2')}"
);

// Preview message
appContent = appContent.replace(
  "💡 DDRA 환산: ≈ ${fmt(earningDdra)} DDRA/일 (1 DDRA = $${(deedraPrice||0.5).toFixed(4)})<br>",
  "💡 ${t('ddraConvert')}: ≈ ${fmt(earningDdra)} DDRA${t('perDay')} (1 DDRA = $${(deedraPrice||0.5).toFixed(4)})<br>"
);
appContent = appContent.replace(
  "📅 만기일: ${getDaysLaterStr(selectedProduct.days)}<br>",
  "📅 ${t('maturityDate')}: ${getDaysLaterStr(selectedProduct.days)}<br>"
);
appContent = appContent.replace(
  "🔒 원금은 만기 후 언프리즈 가능합니다.",
  "🔒 ${t('productHint2')}"
);

// Add these keys
const newKeys = {
  ko: `
    productHint1: '{min} USDT FREEZE 시 일 수익',
    productHint2: '만기 후 언프리즈 가능',
    ddraConvert: 'DDRA 환산',
    maturityDate: '만기일',
  `,
  en: `
    productHint1: 'Daily return for {min} USDT FREEZE',
    productHint2: 'Principal unlockable after maturity',
    ddraConvert: 'DDRA Conv.',
    maturityDate: 'Maturity Date',
  `,
  vi: `
    productHint1: 'Lợi nhuận hàng ngày với {min} USDT FREEZE',
    productHint2: 'Gốc có thể rút sau khi đáo hạn',
    ddraConvert: 'Quy đổi DDRA',
    maturityDate: 'Ngày đáo hạn',
  `,
  th: `
    productHint1: 'ผลตอบแทนรายวันสำหรับ FREEZE {min} USDT',
    productHint2: 'เงินต้นสามารถถอนได้เมื่อครบกำหนด',
    ddraConvert: 'แปลงเป็น DDRA',
    maturityDate: 'วันครบกำหนด',
  `
}

for (const lang of ['ko', 'en', 'vi', 'th']) {
  const searchStr = '  ' + lang + ': {';
  const replaceStr = searchStr + '\\n' + newKeys[lang];
  appContent = appContent.replace(searchStr, replaceStr);
}

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('Patched second set of translations');
