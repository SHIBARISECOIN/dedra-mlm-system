const fs = require('fs');
const appPath = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(appPath, 'utf8');

// Also update notifications text using simple replace instead of regex
const notiKeys = {
  ko: `
    notiTitleMature: '✅ FREEZE 만기 완료',
    notiMsgMature: '[{name}] FREEZE 계약이 만료되었습니다. 원금 {amt} USDT가 지갑에 언프리즈되었습니다.',
    toastMature: '❄️ 만기 FREEZE {n}건의 원금이 언프리즈되었습니다.',
  `,
  en: `
    notiTitleMature: '✅ FREEZE Matured',
    notiMsgMature: '[{name}] FREEZE contract has matured. Principal {amt} USDT has been unfrozen to your wallet.',
    toastMature: '❄️ {n} matured FREEZE principals have been unfrozen.',
  `,
  vi: `
    notiTitleMature: '✅ FREEZE Đáo hạn',
    notiMsgMature: '[{name}] Hợp đồng FREEZE đã đáo hạn. Gốc {amt} USDT đã được hoàn lại vào ví.',
    toastMature: '❄️ {n} khoản gốc FREEZE đáo hạn đã được hoàn lại.',
  `,
  th: `
    notiTitleMature: '✅ FREEZE ครบกำหนด',
    notiMsgMature: '[{name}] สัญญา FREEZE ครบกำหนดแล้ว เงินต้น {amt} USDT ถูกปลดล็อคเข้ากระเป๋าของคุณ',
    toastMature: '❄️ เงินต้น FREEZE ที่ครบกำหนด {n} รายการถูกปลดล็อคแล้ว',
  `
};

for (const lang of ['ko', 'en', 'vi', 'th']) {
  const searchStr = '  ' + lang + ': {';
  const replaceStr = searchStr + '\\n' + notiKeys[lang];
  content = content.replace(searchStr, replaceStr);
}

content = content.replace(
  "title: '✅ FREEZE 만기 완료',",
  "title: t('notiTitleMature'),"
);

content = content.replace(
  "message: `[${inv.productName}] FREEZE 계약이 만료되었습니다. 원금 ${fmt(inv.amount)} USDT가 지갑에 언프리즈되었습니다.`",
  "message: t('notiMsgMature').replace('{name}', inv.productName).replace('{amt}', fmt(inv.amount))"
);

content = content.replace(
  "showToast(`❄️ 만기 FREEZE ${expired.length}건의 원금이 언프리즈되었습니다.`, 'success');",
  "showToast(t('toastMature').replace('{n}', expired.length), 'success');"
);

fs.writeFileSync(appPath, content, 'utf8');
console.log('Patched final logic');
