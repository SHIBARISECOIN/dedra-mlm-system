const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');
code = code.replace(
`      if (r.data.autoApproved) {
        setStatus('✅ 입금 완료! 잔액이 자동으로 업데이트되었습니다.', '#16a34a');
        showToast(\`✅ $\${amount} USDT 입금 완료!\`, 'success');
        setTimeout(() => { closeModal('depositModal'); refreshWallet?.(); }, 2500);
      } else {
        setStatus(\`⏳ 전송 완료! 관리자 확인 후 승인됩니다.\\n해시: \${signature.slice(0,16)}...\`, '#f59e0b');
        showToast('전송 완료! 관리자 확인 후 승인됩니다.', 'info');
      }`,
`      if (r.data.autoApproved) {
        setStatus(t('walletDepositComplete') || '✅ 입금 완료! 잔액이 자동으로 업데이트되었습니다.', '#16a34a');
        showToast((t('walletDepositComplete') || \`✅ $\${amount} USDT 입금 완료!\`).replace('입금 완료', \` $\${amount} USDT 입금 완료\`), 'success');
        setTimeout(() => { closeModal('depositModal'); refreshWallet?.(); }, 2500);
      } else {
        setStatus(\`\${t('walletDepositPending') || '⏳ 전송 완료! 관리자 확인 후 승인됩니다.'}\\n해시: \${signature.slice(0,16)}...\`, '#f59e0b');
        showToast(t('walletDepositPending') || '전송 완료! 관리자 확인 후 승인됩니다.', 'info');
      }`
);
fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
