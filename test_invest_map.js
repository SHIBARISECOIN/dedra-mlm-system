const t = (key) => key;
const inv = { productName: '12개월 상품' };
const startDateStr = '2026.03.24';

const result = `${(inv.productName && inv.productName.includes('12개월') ? t('productMonth12') : inv.productName && inv.productName.includes('6개월') ? t('productMonth6') : inv.productName && inv.productName.includes('3개월') ? t('productMonth3') : inv.productName && inv.productName.includes('1개월') ? t('productMonth1') : inv.productName) || 'FREEZE'} <span style="font-size:12px; font-weight:500; color:var(--text2); margin-left:2px;">(${startDateStr})</span>`

console.log(result);
