const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

const downloadFunc = `\nwindow.downloadTxHistory = function() {
  const txs = window.currentTxData || [];
  if (txs.length === 0) {
    showToast('다운로드할 내역이 없습니다.', 'error');
    return;
  }
  
  let csv = '\\uFEFF'; // BOM for UTF-8 Excel compatibility
  csv += '날짜,유형,금액(USDT),사유/비고\\n';
  
  txs.forEach(tx => {
    let d = new Date();
    if (tx.createdAt && tx.createdAt.seconds) d = new Date(tx.createdAt.seconds * 1000);
    else if (tx.createdAt) d = new Date(tx.createdAt);
    
    const dateStr = d.toLocaleString('ko-KR').replace(/,/g, '');
    const amount = tx.amountUsdt || tx.amount || 0;
    
    // Determine Type Name
    let typeName = tx.type;
    if (tx.type === 'deposit') typeName = '입금';
    else if (tx.type === 'withdrawal') typeName = '출금';
    else if (tx.type === 'roi' || tx.type === 'daily_roi') typeName = 'FREEZE(이자)';
    else if (tx.type === 'direct_bonus') typeName = '추천 수당';
    else if (tx.type === 'rank_bonus' || tx.type === 'rank_gap_passthru') typeName = '직급 수당';
    else if (tx.type === 'rank_matching' || tx.type === 'rank_equal_or_higher_override' || tx.type === 'rank_equal_or_higher_override_1pct') typeName = '추천 매칭';
    else if (tx.type === 'center_fee') typeName = '센터 피';
    
    let reason = tx.reason || '';
    if (tx.txHash) reason += ' ' + tx.txHash.substring(0, 10);
    reason = reason.replace(/,/g, ' '); // avoid CSV break
    
    csv += \`\${dateStr},\${typeName},\${amount.toFixed(2)},\${reason}\\n\`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  const datePicker = document.getElementById('txDateFilter');
  const dStr = datePicker && datePicker.value ? datePicker.value : '전체';
  
  link.setAttribute('download', \`거래내역_\${dStr}.csv\`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};\n`;

if (!content.includes('window.downloadTxHistory')) {
  content += downloadFunc;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Added downloadTxHistory');
}
