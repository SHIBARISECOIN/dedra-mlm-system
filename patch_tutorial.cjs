const fs = require('fs');

// 1. Patch index.html
let indexHtml = fs.readFileSync('./public/index.html', 'utf-8');
const tutorialHtml = `
  <!-- Tutorial Styles & DOM -->
  <style>
    #tutOverlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.85); z-index: 99998; display: none; pointer-events: auto; backdrop-filter: blur(2px); }
    .tut-highlight-safe { position: relative !important; z-index: 99999 !important; box-shadow: 0 0 0 4px #10b981, 0 0 20px rgba(16,185,129,0.8) !important; pointer-events: auto !important; border-radius: 8px; animation: pulseTut 1.5s infinite; background: var(--surface) !important; color:var(--text) !important; }
    
    @keyframes pulseTut {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
      70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    #tutBox {
      position: fixed; z-index: 100000; bottom: 12%; left: 50%; transform: translateX(-50%); width: 88%; max-width: 360px;
      background: #1e293b; color: #f8fafc; padding: 22px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.7);
      display: none; flex-direction: column; gap: 15px; font-weight: 500; border: 1px solid #334155; text-align: left;
    }
    #tutBox .tut-text { font-size: 16px; line-height: 1.5; color: #f1f5f9; word-break: keep-all; }
    #tutBox .tut-text span.hl { color: #34d399; font-weight: 800; }
    #tutBox .tut-btns { display: flex; justify-content: space-between; gap: 10px; margin-top: 5px; }
    .tut-btn-next { background: linear-gradient(135deg, #10b981, #059669); color: #fff; padding: 12px 15px; border-radius: 12px; flex: 1; text-align: center; cursor: pointer; border: none; font-weight: 800; font-size: 15px; box-shadow: 0 4px 10px rgba(16,185,129,0.3); transition: 0.2s;}
    .tut-btn-next:active { transform: scale(0.96); }
    .tut-btn-close { background: #334155; color: #cbd5e1; padding: 12px 15px; border-radius: 12px; cursor: pointer; border: none; font-weight: 700; font-size: 14px; transition: 0.2s;}
    .tut-btn-close:active { transform: scale(0.96); }
    
    #guideFloatBtn {
      position: fixed; bottom: 90px; right: 20px; background: linear-gradient(135deg, #10b981, #059669);
      color: white; padding: 12px 18px; border-radius: 30px; box-shadow: 0 6px 16px rgba(16,185,129,0.4);
      z-index: 9000; cursor: pointer; font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px;
      animation: floatBounce 2.5s infinite; transition: 0.2s;
    }
    #guideFloatBtn:active { transform: scale(0.92); }
    @keyframes floatBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  </style>

  <div id="tutOverlay"></div>
  <div id="tutBox">
    <div style="font-size:12px; color:#10b981; font-weight:900; letter-spacing:1px; text-transform:uppercase; margin-bottom:-5px;" id="tutStepLabel">STEP 1/5</div>
    <div class="tut-text" id="tutText">Step text</div>
    <div class="tut-btns">
      <button class="tut-btn-close" onclick="stopTutorial()" id="tutBtnClose">닫기</button>
      <button class="tut-btn-next" id="tutNextBtn" onclick="nextTutorial()">다음 ➔</button>
    </div>
  </div>
  <div id="guideFloatBtn" onclick="startTutorial()">
    <i class="fas fa-magic"></i> <span id="guideFloatText">입금 방법 안내</span>
  </div>
`;

if (!indexHtml.includes('id="tutOverlay"')) {
    indexHtml = indexHtml.replace('</body>', tutorialHtml + '\n</body>');
    fs.writeFileSync('./public/index.html', indexHtml);
    console.log('Injected tutorial DOM into index.html');
}

// 2. Patch app.js
let appJs = fs.readFileSync('./public/static/app.js', 'utf-8');

const tutorialJs = `
// ==========================================
// 입금 튜토리얼 (Interactive Guide)
// ==========================================
const tutI18n = {
  ko: {
    btn: '입금 방법 안내', close: '닫기', next: '다음 ➔', done: '신청 완료!',
    s1: '<span class="hl">USDT 입금</span> 버튼을 클릭하여 입금 창을 열어주세요.',
    s2: '<span class="hl">수동 입금</span> 탭을 선택해주세요.',
    s3: '회사 <span class="hl">입금 주소를 복사</span>한 뒤, 개인 지갑(Phantom 등)에서 이 주소로 USDT를 송금하세요.<br><br><span style="font-size:13px;color:#94a3b8">송금을 마쳤다면 [다음]을 누르세요.</span>',
    s4: '송금하신 <span class="hl">수량</span>과 전송 내역에 있는 <span class="hl">TXID(트랜잭션 해시)</span>를 정확히 입력해주세요.',
    s5: '마지막으로 <span class="hl">입금 신청</span> 버튼을 누르면 끝입니다! 관리자 확인 후 잔액이 바로 반영됩니다.'
  },
  en: {
    btn: 'How to Deposit', close: 'Close', next: 'Next ➔', done: 'Done!',
    s1: 'Click the <span class="hl">Deposit USDT</span> button to open the deposit window.',
    s2: 'Select the <span class="hl">Manual Deposit</span> tab.',
    s3: '<span class="hl">Copy the company address</span> and send USDT from your personal wallet.<br><br><span style="font-size:13px;color:#94a3b8">Click [Next] after sending.</span>',
    s4: 'Enter the exact <span class="hl">Amount</span> you sent and the <span class="hl">TXID (Hash)</span>.',
    s5: 'Click the <span class="hl">Submit Deposit</span> button to finish! Balance updates after admin approval.'
  },
  vi: {
    btn: 'Cách nạp tiền', close: 'Đóng', next: 'Tiếp ➔', done: 'Hoàn tất!',
    s1: 'Nhấp vào nút <span class="hl">Nạp USDT</span> để mở cửa sổ nạp tiền.',
    s2: 'Chọn tab <span class="hl">Nạp thủ công</span>.',
    s3: '<span class="hl">Sao chép địa chỉ công ty</span> và gửi USDT từ ví cá nhân của bạn.<br><br><span style="font-size:13px;color:#94a3b8">Nhấp [Tiếp] sau khi gửi xong.</span>',
    s4: 'Nhập chính xác <span class="hl">Số lượng</span> đã gửi và <span class="hl">TXID (Mã giao dịch)</span>.',
    s5: 'Nhấp nút <span class="hl">Gửi yêu cầu</span> để hoàn tất! Số dư sẽ cập nhật sau khi duyệt.'
  },
  th: {
    btn: 'วิธีฝากเงิน', close: 'ปิด', next: 'ถัดไป ➔', done: 'เสร็จสิ้น!',
    s1: 'คลิกปุ่ม <span class="hl">ฝาก USDT</span> เพื่อเปิดหน้าต่างฝากเงิน',
    s2: 'เลือกแท็บ <span class="hl">ฝากด้วยตนเอง</span>',
    s3: '<span class="hl">คัดลอกที่อยู่บริษัท</span> และส่ง USDT จากกระเป๋าส่วนตัวของคุณ<br><br><span style="font-size:13px;color:#94a3b8">คลิก [ถัดไป] หลังจากส่งเสร็จ</span>',
    s4: 'กรอก <span class="hl">จำนวน</span> ที่ส่งและ <span class="hl">TXID (แฮช)</span> ให้ถูกต้อง',
    s5: 'คลิกปุ่ม <span class="hl">ส่งคำขอฝาก</span> เพื่อเสร็จสิ้น! ยอดจะอัปเดตหลังอนุมัติ'
  },
  zh: {
    btn: '存款指南', close: '关闭', next: '下一步 ➔', done: '完成！',
    s1: '点击 <span class="hl">存入USDT</span> 按钮打开存款窗口。',
    s2: '选择 <span class="hl">手动存款</span> 选项卡。',
    s3: '<span class="hl">复制公司地址</span>并从您的个人钱包发送USDT。<br><br><span style="font-size:13px;color:#94a3b8">发送完成后点击[下一步]。</span>',
    s4: '准确输入您发送的<span class="hl">金额</span>和<span class="hl">TXID（交易哈希）</span>。',
    s5: '最后点击 <span class="hl">提交存款</span> 按钮即可！管理员确认后余额将立即更新。'
  }
};

let currentTutStep = 0;
let tutHighlightedEl = null;
let tutObserver = null;

function getTutStr(key) {
    const lang = window.currentLang || 'ko';
    return tutI18n[lang]?.[key] || tutI18n['ko'][key];
}

window.startTutorial = function() {
    if (!window.currentUser) { showToast('로그인 후 이용 가능합니다.', 'warning'); return; }
    
    document.getElementById('tutOverlay').style.display = 'block';
    document.getElementById('tutBox').style.display = 'flex';
    currentTutStep = 1;
    
    // 만약 입금 모달이 이미 열려있으면 2단계로 점프
    const mod = document.getElementById('depositModal');
    if (mod && !mod.classList.contains('hidden')) {
        currentTutStep = 2;
    }
    runTutorialStep();
};

window.stopTutorial = function() {
    document.getElementById('tutOverlay').style.display = 'none';
    document.getElementById('tutBox').style.display = 'none';
    if (tutHighlightedEl) {
        tutHighlightedEl.classList.remove('tut-highlight-safe');
        tutHighlightedEl.removeEventListener('click', handleTutClick);
    }
    if (tutObserver) clearInterval(tutObserver);
    currentTutStep = 0;
};

function handleTutClick(e) {
    if (currentTutStep === 1) {
        setTimeout(() => { currentTutStep = 2; runTutorialStep(); }, 400);
    } else if (currentTutStep === 2) {
        setTimeout(() => { currentTutStep = 3; runTutorialStep(); }, 400);
    } else if (currentTutStep === 5) {
        stopTutorial();
    }
}

window.nextTutorial = function() {
    if (currentTutStep === 5) {
        stopTutorial();
        return;
    }
    currentTutStep++;
    runTutorialStep();
};

function runTutorialStep() {
    if (tutHighlightedEl) {
        tutHighlightedEl.classList.remove('tut-highlight-safe');
        tutHighlightedEl.removeEventListener('click', handleTutClick);
    }
    if (tutObserver) clearInterval(tutObserver);

    document.getElementById('tutStepLabel').innerText = \`STEP \${currentTutStep}/5\`;
    document.getElementById('tutText').innerHTML = getTutStr('s' + currentTutStep);
    document.getElementById('tutBtnClose').innerText = getTutStr('close');
    document.getElementById('tutNextBtn').innerText = currentTutStep === 5 ? getTutStr('done') : getTutStr('next');
    
    // 1단계, 2단계는 유저가 직접 클릭하도록 강제 (다음 버튼 숨김)
    document.getElementById('tutNextBtn').style.display = (currentTutStep === 1 || currentTutStep === 2) ? 'none' : 'block';

    let targetSelector = '';
    if (currentTutStep === 1) {
        targetSelector = 'button[onclick="showDepositModal()"]';
        if (typeof switchPage === 'function') switchPage('wallet'); // 지갑 탭으로 이동
    } else if (currentTutStep === 2) {
        targetSelector = '#depTabManual';
    } else if (currentTutStep === 3) {
        targetSelector = '.wallet-address-box'; 
    } else if (currentTutStep === 4) {
        targetSelector = '#depositTxid'; 
    } else if (currentTutStep === 5) {
        targetSelector = 'button[onclick="submitDeposit()"]';
    }

    let attempts = 0;
    tutObserver = setInterval(() => {
        const el = document.querySelector(targetSelector);
        if (el && el.offsetParent !== null) { 
            clearInterval(tutObserver);
            tutHighlightedEl = el;
            el.classList.add('tut-highlight-safe');
            
            // 자동 클릭 이벤트 바인딩 (1, 2, 5단계)
            if (currentTutStep === 1 || currentTutStep === 2 || currentTutStep === 5) {
                el.addEventListener('click', handleTutClick);
            }
            // 살짝 위로 스크롤
            const y = el.getBoundingClientRect().top + window.scrollY - 150;
            window.scrollTo({top: y, behavior: 'smooth'});
        }
        attempts++;
        if (attempts > 30) clearInterval(tutObserver); // 3초 대기 후 포기
    }, 100);
}

// applyLang 함수 훅을 통해 플로팅 버튼 언어 변경
const originalApplyLang = window.applyLang;
window.applyLang = function() {
    if (originalApplyLang) originalApplyLang();
    const gBtn = document.getElementById('guideFloatText');
    if (gBtn) {
        const lang = window.currentLang || 'ko';
        gBtn.innerText = tutI18n[lang]?.btn || tutI18n['ko'].btn;
    }
};
`;

if (!appJs.includes('startTutorial')) {
    fs.writeFileSync('./public/static/app.js', appJs + '\n\n' + tutorialJs);
    console.log('Injected tutorial logic into app.js');
}

