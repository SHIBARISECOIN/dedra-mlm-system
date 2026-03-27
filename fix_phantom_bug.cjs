const fs = require('fs');
let html = fs.readFileSync('public/static/admin.html', 'utf8');

html = html.replace('let txSignature = null;', 'let signature = null;');
html = html.replace(/txSignature/g, 'signature');

// 혹시 모를 failWithdrawalProcessing 방어코드
// catch(e) 블록 안에서, 만약 signature가 존재한다면 (이미 전송되었다면)
// 상태를 실패로 변경하지 않도록 안내만 하고 리턴하도록 수정
const oldCatch = `} catch(e) {
                console.error(e);
                let msg = e.message || '송금 실패';
                if (msg.includes('custom program error: 0x1')) {
                    msg = '관리자 지갑에 송금할 DDRA 토큰 잔액이 부족합니다.';
                }
                showToast('❌ ' + msg, 'error');
                
                // 🛑 전송 실패 시 DB 상태를 실패(failed)로 변경
                try { await api.failWithdrawalProcessing(currentTx.id, currentAdmin.uid, msg); } catch(err) { console.error('Unlock error', err); }
                loadWithdrawals(currentWithdrawalStatus);
            } finally {`;

const newCatch = `} catch(e) {
                console.error(e);
                let msg = e.message || '송금 실패';
                if (msg.includes('custom program error: 0x1')) {
                    msg = '관리자 지갑에 송금할 DDRA 토큰 잔액이 부족합니다.';
                }
                
                if (signature) {
                    showToast('⚠️ 전송은 되었으나 승인 처리 중 오류 발생. 수동 승인 바람!', 'warning');
                    // 전송이 이미 진행되었으므로, 실패로 상태를 변경하지 않음.
                    // 대신 관리자가 수동으로 TXID를 넣고 승인해야 할 수 있으므로 모달을 닫지 않음.
                } else {
                    showToast('❌ ' + msg, 'error');
                    // 🛑 전송 실패 시 DB 상태를 실패(failed)로 변경
                    try { await api.failWithdrawalProcessing(currentTx.id, currentAdmin.uid, msg); } catch(err) { console.error('Unlock error', err); }
                }
                loadWithdrawals(currentWithdrawalStatus);
            } finally {`;

html = html.replace(oldCatch, newCatch);

fs.writeFileSync('public/static/admin.html', html);
console.log('Fixed syntax and catch logic');
