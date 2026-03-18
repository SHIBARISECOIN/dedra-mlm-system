const fs = require('fs');

let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

const jsCode = `
<script>
// ==========================================
// 임의 입금/차감 관리 (Manual Adjust)
// ==========================================
window.submitManualAdjust = async function() {
    const uidOrEmail = document.getElementById('maUserId').value.trim();
    const walletType = document.getElementById('maWalletType').value;
    const sign = document.getElementById('maSign').value;
    const amountStr = document.getElementById('maAmount').value.trim();
    const reason = document.getElementById('maReason').value.trim();
    const alertEl = document.getElementById('maAlert');
    
    alertEl.style.display = 'none';
    const showErr = (msg) => { alertEl.textContent = msg; alertEl.className = 'inline-alert error'; alertEl.style.display = 'block'; };
    const showSuc = (msg) => { alertEl.textContent = msg; alertEl.className = 'inline-alert success'; alertEl.style.display = 'block'; };

    if (!uidOrEmail) return showErr('회원 ID 또는 이메일을 입력하세요.');
    if (!amountStr || isNaN(amountStr) || Number(amountStr) <= 0) return showErr('올바른 금액을 입력하세요.');
    if (!reason) return showErr('메모/사유를 입력하세요.');

    const amount = Number(amountStr);
    const adjAmt = sign === 'add' ? amount : -amount;

    const btn = document.getElementById('maSubmitBtn');
    btn.disabled = true;
    btn.textContent = '처리 중...';

    try {
        const { collection, query, where, getDocs, doc, getDoc, runTransaction, serverTimestamp } = window.FB;
        let targetUserId = uidOrEmail;
        let targetUserEmail = '';
        
        // 1. 유저 찾기 (UID 조회 후 없으면 Email 조회)
        let userSnap = await getDoc(doc(window.db, 'users', uidOrEmail));
        if (!userSnap.exists()) {
            const q = query(collection(window.db, 'users'), where('email', '==', uidOrEmail));
            const qs = await getDocs(q);
            if (qs.empty) {
                const q2 = query(collection(window.db, 'users'), where('username', '==', uidOrEmail));
                const qs2 = await getDocs(q2);
                if (qs2.empty) throw new Error('해당 회원을 찾을 수 없습니다.');
                targetUserId = qs2.docs[0].id;
                targetUserEmail = qs2.docs[0].data().email;
            } else {
                targetUserId = qs.docs[0].id;
                targetUserEmail = qs.docs[0].data().email;
            }
        } else {
            targetUserEmail = userSnap.data().email;
        }

        // 2. 트랜잭션으로 잔액 업데이트 및 이력 남기기
        await runTransaction(window.db, async (t) => {
            const walletRef = doc(window.db, 'wallets', targetUserId);
            const userRef = doc(window.db, 'users', targetUserId);
            const txRef = doc(collection(window.db, 'transactions'));
            
            const wSnap = await t.get(walletRef);
            if (!wSnap.exists()) throw new Error('회원 지갑 정보가 없습니다.');
            
            const wData = wSnap.data();
            const currentBal = wData[walletType] || 0;
            const newBal = currentBal + adjAmt;
            if (newBal < 0) throw new Error('차감 시 잔액이 0보다 작아질 수 없습니다. 현재 잔액: ' + currentBal);

            // 지갑 업데이트
            t.update(walletRef, { [walletType]: newBal });
            
            // 회원 플래그 업데이트
            t.update(userRef, { hasManualDeposit: true });
            
            // 내역 생성
            t.set(txRef, {
                type: 'manual_adjust',
                userId: targetUserId,
                userEmail: targetUserEmail,
                amount: adjAmt,
                walletType: walletType,
                reason: reason,
                createdAt: serverTimestamp(),
                adminId: (window.currentUser ? window.currentUser.uid : 'admin')
            });
        });

        showSuc('임의 조정이 성공적으로 처리되었습니다.');
        document.getElementById('maAmount').value = '';
        document.getElementById('maReason').value = '';
        window.loadManualAdjustLogs();
        
    } catch(err) {
        console.error(err);
        showErr(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 임의 조정 실행';
    }
};

window.loadManualAdjustLogs = async function() {
    const wrap = document.getElementById('maLogWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
    
    try {
        const { collection, query, where, orderBy, getDocs, limit } = window.FB;
        const q = query(
            collection(window.db, 'transactions'),
            where('type', '==', 'manual_adjust'),
            limit(50)
        );
        const snap = await getDocs(q);
        
        let rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
        rows.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
        
        if (!rows.length) {
            wrap.innerHTML = '<div class="empty-state">내역이 없습니다.</div>';
            return;
        }

        const walletMap = {
            'usdtBalance': 'USDT',
            'bonusBalance': '보너스',
            'lockedBalance': '투자(FREEZE)'
        };

        wrap.innerHTML = '<div class="table-wrap"><table>' +
            '<thead><tr>' +
            '<th>일시</th>' +
            '<th>회원</th>' +
            '<th>지갑</th>' +
            '<th>조정 금액</th>' +
            '<th>사유/메모</th>' +
            '</tr></thead>' +
            '<tbody>' + rows.map(r => {
                const isAdd = r.amount > 0;
                const cColor = isAdd ? 'color:#2563eb' : 'color:#ef4444';
                const sign = isAdd ? '+' : '';
                return '<tr>' +
                    '<td>' + window.fmtDate(r.createdAt) + '</td>' +
                    '<td><strong style="color:#2563eb;">' + window.formatUserLabel(r.userId, r.userEmail) + '</strong></td>' +
                    '<td>' + (walletMap[r.walletType] || r.walletType) + '</td>' +
                    '<td><strong style="' + cColor + '">' + sign + r.amount + '</strong></td>' +
                    '<td>' + (r.reason || '-') + '</td>' +
                '</tr>';
            }).join('') + '</tbody></table></div>';
            
    } catch(err) {
        console.error(err);
        wrap.innerHTML = '<div class="empty-state">불러오기 실패: ' + err.message + '</div>';
    }
};

// 메뉴 전환 시 자동 로드
document.addEventListener('DOMContentLoaded', () => {
    // wait a bit for FB to initialize
    setTimeout(() => {
        const maBtn = document.querySelector('.menu-item[data-page="manualAdjust"]');
        if (maBtn) {
            maBtn.addEventListener('click', () => {
                window.loadManualAdjustLogs();
            });
        }
    }, 1500);
});
</script>
</body>
`;

adminHtml = adminHtml.replace('</body>', jsCode);
fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
console.log('Added logic script');
