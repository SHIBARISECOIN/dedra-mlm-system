const fs = require('fs');

const targetFile = 'public/static/admin.html';
let content = fs.readFileSync(targetFile, 'utf8');

// We need to inject the lock check in the phantomBtn click event listener right before provider.connect() or earlier.
const phantomClickStart = `if (!await _adminConfirm(\`👻 팬텀 지갑을 통해 바로 송금하시겠습니까?\\n\\n송금액: \${dedraAmt} DDRA\\n받는주소: \${wallet}\`)) return;`;
const newPhantomClickLogic = `if (!await _adminConfirm(\`👻 팬텀 지갑을 통해 바로 송금하시겠습니까?\\n\\n송금액: \${dedraAmt} DDRA\\n받는주소: \${wallet}\`)) return;
            
            try {
                phantomBtn.disabled = true;
                phantomBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#fff;"></div> 처리 중...';
                
                // 🛑 이중 출금 방지: 블록체인 전송 전 DB 상태를 먼저 '처리중'으로 잠금 (Lock)
                const lockRes = await api.markWithdrawalProcessing(currentTx.id, currentAdmin.uid);
                if (!lockRes.success) {
                    showToast('❌ 전송 불가: ' + lockRes.error, 'error');
                    // Lock 실패시 모달 닫기
                    closeModal('withdrawalModal');
                    loadWithdrawals(currentWithdrawalStatus);
                    return; // 송금 진행 중단
                }
`;

// Find the try block start
content = content.replace(
  phantomClickStart + "\n            \n            try {\n                phantomBtn.disabled = true;\n                phantomBtn.innerHTML = '<div class=\"spinner\" style=\"width:14px;height:14px;border-width:2px;border-top-color:#fff;\"></div> 처리 중...';",
  newPhantomClickLogic
);


// Also handle if the blockchain part fails, we need to unlock it.
const catchBlockStart = "} catch(e) {";
const catchBlockReplacement = `} catch(e) {
                // 🛑 전송 실패 시 DB 상태를 다시 대기중(pending)으로 복구 (Unlock)
                try { await api.unmarkWithdrawalProcessing(currentTx.id, currentAdmin.uid); } catch(err) { console.error('Unlock error', err); }
                `;

content = content.replace(catchBlockStart, catchBlockReplacement);

fs.writeFileSync(targetFile, content);

// Also do the same for temp_admin_0.js if it's there
const targetFile2 = 'public/static/temp_admin_0.js';
if (fs.existsSync(targetFile2)) {
  let content2 = fs.readFileSync(targetFile2, 'utf8');
  content2 = content2.replace(
    phantomClickStart + "\n            \n            try {\n                phantomBtn.disabled = true;\n                phantomBtn.innerHTML = '<div class=\"spinner\" style=\"width:14px;height:14px;border-width:2px;border-top-color:#fff;\"></div> 처리 중...';",
    newPhantomClickLogic
  );
  content2 = content2.replace(catchBlockStart, catchBlockReplacement);
  fs.writeFileSync(targetFile2, content2);
}

console.log('Patched admin frontend successfully!');
