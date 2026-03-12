/**
 * DEEDRA 회원용 앱 v2.0 - 메인 로직
 * UI 설계안 기반 전면 개편
 */

// ===== 사운드 엔진 (Web Audio API) =====
const SFX = (() => {
  let ctx = null;
  const init = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); };

  const play = (type) => {
    try {
      init();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      switch(type) {
        case 'click': {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(400, t+0.1);
          g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.1);
          o.start(t); o.stop(t+0.1); break;
        }
        case 'coin': {
          [0,0.05,0.1,0.15,0.2].forEach((d,i) => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine'; o.frequency.setValueAtTime(1200+i*200, t+d);
            g.gain.setValueAtTime(0.2, t+d); g.gain.exponentialRampToValueAtTime(0.001, t+d+0.15);
            o.start(t+d); o.stop(t+d+0.15);
          }); break;
        }
        case 'dice_roll': {
          for(let i=0;i<6;i++){
            const b = ctx.createOscillator(); const bg = ctx.createGain();
            b.connect(bg); bg.connect(ctx.destination);
            b.type = 'square'; b.frequency.setValueAtTime(200+Math.random()*100, t+i*0.07);
            bg.gain.setValueAtTime(0.08, t+i*0.07); bg.gain.exponentialRampToValueAtTime(0.001, t+i*0.07+0.06);
            b.start(t+i*0.07); b.stop(t+i*0.07+0.06);
          } break;
        }
        case 'slot_spin': {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sawtooth'; o.frequency.setValueAtTime(150,t); o.frequency.linearRampToValueAtTime(80,t+0.8);
          g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.8);
          o.start(t); o.stop(t+0.8); break;
        }
        case 'card_deal': {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(600,t);
          g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
          o.start(t); o.stop(t+0.08); break;
        }
        case 'roulette_spin': {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          const lfo = ctx.createOscillator(); const lfog = ctx.createGain();
          lfo.connect(lfog); lfog.connect(o.frequency);
          lfo.frequency.value = 12; lfog.gain.setValueAtTime(30,t); lfog.gain.exponentialRampToValueAtTime(2,t+3);
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(80,t+3);
          g.gain.setValueAtTime(0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+3);
          lfo.start(t); o.start(t); lfo.stop(t+3); o.stop(t+3); break;
        }
        case 'win': {
          const notes = [523,659,784,1047];
          notes.forEach((freq,i) => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine'; o.frequency.value = freq;
            g.gain.setValueAtTime(0,t+i*0.12); g.gain.linearRampToValueAtTime(0.25,t+i*0.12+0.05);
            g.gain.exponentialRampToValueAtTime(0.001,t+i*0.12+0.3);
            o.start(t+i*0.12); o.stop(t+i*0.12+0.3);
          }); break;
        }
        case 'jackpot': {
          const notes = [523,587,659,698,784,880,988,1047,1175,1319];
          notes.forEach((freq,i) => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine'; o.frequency.value = freq;
            g.gain.setValueAtTime(0,t+i*0.08); g.gain.linearRampToValueAtTime(0.3,t+i*0.08+0.04);
            g.gain.exponentialRampToValueAtTime(0.001,t+i*0.08+0.4);
            o.start(t+i*0.08); o.stop(t+i*0.08+0.4);
          }); break;
        }
        case 'lose': {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sawtooth'; o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(100,t+0.4);
          g.gain.setValueAtTime(0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
          o.start(t); o.stop(t+0.4); break;
        }
      }
    } catch(e) {}
  };
  return { play };
})();

// ===== 다국어(i18n) 번역 데이터 =====
const TRANSLATIONS = {
  ko: {
    // 로그인/회원가입
    authTagline: '🔐 안전하고 스마트한 가상자산 FREEZE',
    loginTab: '로그인',
    registerTab: '회원가입',
    labelEmail: '이메일',
    labelPassword: '비밀번호',
    placeholderEmail: '이메일을 입력하세요',
    placeholderPassword: '비밀번호를 입력하세요',
    placeholderPasswordMin: '8자리 이상 입력하세요',
    btnLogin: '로그인',
    forgotPassword: '비밀번호를 잊으셨나요?',
    labelName: '이름',
    placeholderName: '이름을 입력하세요',
    labelReferral: '추천인 코드',
    referralRequired: '* 필수',
    placeholderReferral: '추천인 코드를 입력하세요',
    btnRegister: '회원가입',
    // 홈
    greeting: '안녕하세요 👋',
    totalAssetLabel: '총 자산 (USDT 환산)',
    assetLocked: 'USDT 원금 (잠금)',
    assetInvesting: '❄️ FREEZE 중',
    assetInterest: '수익 잔액 (출금 가능)',
    btnDeposit: 'USDT 입금',
    btnWithdraw: 'DDRA 출금',
    deedraPrice: 'DDRA 현재 시세',
    recentUpdated: '최근 업데이트: ',
    investingNow: '❄️ 진행 중인 FREEZE',
    investAmount: 'FREEZE 금액',
    expectedReturn: '예상 수익',
    remaining: '남은 기간',
    announcements: '📢 공지사항',
    seeAll: '전체보기',
    recentTx: '💳 최근 거래',
    // 투자
    pageInvest: '❄️ FREEZE',
    activeInvest: '활성 투자',
    totalInvest: '총 투자금',
    expectedReturnLabel: '예상 수익',
    simTitle: '❄️ FREEZE 수익 시뮬레이터',
    simSelectProduct: '상품 선택',
    simUsdtAmount: 'USDT 금액',
    simInvestAmount: 'FREEZE 금액',
    simPeriod: '기간',
    simRoi: '수익률',
    simEarning: '일 수익 (USDT)',
    simEarningUsd: '총 수익 (USDT)',
    productListTitle: '💼 투자 상품',
    myInvestTitle: '📋 내 FREEZE 현황',
    // 네트워크
    pageNetwork: '🌐 네트워크',
    directRef: '직접 추천',
    totalDownline: '전체 하위',
    earnedBonus: '획득 보너스',
    myReferralCode: '내 추천 코드',
    btnCopy: '복사',
    btnShare: '추천 링크 공유',
    currentRank: '현재 직급',
    nextRank: '다음 직급: ',
    directRefCount: '직접 추천: ',
    orgChart: '🗂 조직도',
    orgReset: '초기화',
    orgLoading: '조직도를 불러오는 중...',
    directRefList: '👥 직접 추천인',
    // Play
    pagePlay: '🎮 Play',
    gameWalletLabel: '게임 지갑 잔액',
    btnCharge: '충전',
    gameSelect: '🎰 게임 선택',
    gameOddEven: '홀짝',
    gameOddEvenDesc: '50% 확률, 2배 수익',
    gameDice: '주사위',
    gameDiceDesc: '숫자 맞추기 6배',
    gameSlot: '슬롯머신',
    gameSlotDesc: '잭팟 최대 50배',
    gameBaccarat: '바카라',
    gameBaccaratDesc: '라이브 카지노',
    gameRoulette: '룰렛',
    gameRouletteDesc: '숫자/색상 베팅',
    gamePoker: '포커',
    gamePokerDesc: '텍사스 홀덤',
    gameSoon: '준비중',
    betAmount: '💰 베팅 금액',
    maxBalance: '최대 잔액',
    coinHint: '홀 또는 짝을 선택하세요',
    choiceOdd: '홀 (Odd)',
    choiceEven: '짝 (Even)',
    gameAreaOddEven: '🪙 홀짝 게임',
    gameAreaDice: '🎲 주사위 게임',
    gameAreaSlot: '🎰 슬롯머신',
    gameAreaRoulette: '🎡 룰렛',
    rlSimpleBet: '간단 베팅',
    rlNumberBet: '숫자 베팅',
    rlSelectedBet: '선택한 베팅:',
    rlNone: '없음',
    rlSpin: '스핀!',
    rlRed: '🔴 레드 ×2',
    rlBlack: '⚫ 블랙 ×2',
    rlZero: '🟢 제로 ×35',
    rlOdd: '홀수 ×2',
    rlEven: '짝수 ×2',
    rlLow: '1-18 ×2',
    rlHigh: '19-36 ×2',
    rlDoz1: '1-12 ×3',
    rlDoz2: '13-24 ×3',
    rlDoz3: '25-36 ×3',
    recentGameLog: '📋 최근 게임 기록',
    gameStart: '게임을 시작해보세요!',
    // More
    walletSection: '💰 지갑',
    usdtBalance: 'USDT 잔액',
    deedraBalance: 'DDRA 게임 잔액',
    bonusBalance: '수익 잔액 (출금 가능)',
    txHistory: '📊 거래 내역',
    txAll: '전체',
    txDeposit: '입금',
    txWithdraw: '출금',
    txInvest: 'FREEZE',
    moreAnnouncements: '📢 공지사항',
    accountMgmt: '⚙️ 계정 관리',
    profileEdit: '프로필 수정',
    passwordChange: '비밀번호 변경',
    withdrawPin: '출금 PIN 설정',
    support: '1:1 문의',
    settings: '🔧 설정',
    darkMode: '다크 모드',
    language: '언어',
    notification: '알림',
    appVersion: '앱 버전',
    logout: '로그아웃',
    // 모달
    modalDeposit: '💰 USDT 입금 신청',
    depositAddrLabel: '회사 입금 주소 (TRC20)',
    depositAddrLoading: '주소 로딩중...',
    depositAmountLabel: '입금 금액 (USDT)',
    depositTxidLabel: 'TXID (트랜잭션 해시)',
    depositTxidPlaceholder: '트랜잭션 해시 입력',
    depositMemoLabel: '메모 (선택)',
    depositMemoPlaceholder: '메모 입력 (선택)',
    depositWarning: '⚠️ 반드시 위 주소로 입금 후 TXID를 입력해주세요. 관리자 승인 후 잔액이 업데이트됩니다.',
    btnCancel: '취소',
    btnSubmitDeposit: '입금 신청',
    modalWithdraw: '💸 수익 출금 신청 (DDRA 지급)',
    withdrawAvailLabel: '출금 가능 수익 (USDT)',
    withdrawAmountLabel: '출금 금액 (USDT)',
    withdrawAddressLabel: '수신 지갑 주소',
    withdrawAddressPlaceholder: '수신 지갑 주소 입력',
    withdrawPinLabel: '출금 PIN (6자리)',
    withdrawWarning: '⚠️ 출금 신청 후 관리자 승인까지 1~3 영업일 소요됩니다.',
    btnSubmitWithdraw: '출금 신청',
    modalInvest: '❄️ FREEZE 신청',
    investAmountLabel: 'FREEZE 금액 (USDT)',
    btnSubmitInvest: 'FREEZE 신청',
    modalCharge: '🎮 게임 지갑 충전',
    chargeInfoLabel: 'DDRA 잔액에서 게임 지갑으로 이동',
    chargeHolding: '보유: ',
    chargeAmountLabel: '충전 금액 (DDRA)',
    btnSubmitCharge: '충전',
    modalPin: '🔐 출금 PIN 설정',
    newPinLabel: '새 PIN (6자리)',
    confirmPinLabel: 'PIN 확인',
    btnSave: '저장',
    modalProfile: '✏️ 프로필 수정',
    labelPhone: '연락처',
    placeholderPhone: '010-0000-0000',
    modalTicket: '💬 1:1 문의',
    ticketTitleLabel: '제목',
    ticketTitlePlaceholder: '문의 제목',
    ticketContentLabel: '내용',
    ticketContentPlaceholder: '문의 내용을 입력하세요',
    btnClose: '닫기',
    btnSubmitTicket: '문의 등록',
    modalAnnouncement: '📢 공지사항',
    // 토스트 메시지
    toastCopied: '복사되었습니다',
    toastShared: '링크가 공유되었습니다',
    toastLinkCopied: '링크가 복사되었습니다',
    toastPasswordReset: '비밀번호 재설정 이메일이 발송되었습니다',
    toastPinSuccess: 'PIN이 설정되었습니다',
    toastSettingFail: '설정 저장에 실패했습니다',
    toastProfileSaved: '프로필이 저장되었습니다',
    toastLogoutSuccess: '로그아웃되었습니다',
    toastAddrCopied: '주소가 복사되었습니다!',
    toastRefCodeCopied: '추천 코드 복사 완료!',
    toastInviteLinkCopied: '초대 링크 복사 완료!',
    toastDepositDone: '입금 신청 완료! 관리자 승인을 기다려주세요.',
    toastWithdrawDone: '출금 신청 완료! 처리까지 1~3 영업일 소요됩니다.',
    toastInvestDone: 'FREEZE 신청 완료! ❄️🎉',
    toastChargeDone: ' DDRA 충전 완료!',
    toastGameChargeFirst: '게임 지갑을 먼저 충전해주세요.',
    toastNoBalance: '잔액 부족',
    toastSelectBet: '베팅을 먼저 선택하세요.',
    toastEnterName: '이름을 입력하세요.',
    toastPinMismatch: 'PIN이 일치하지 않습니다.',
    toastPinDigit: '숫자 6자리를 입력하세요.',
    toastPinLen: '6자리 PIN을 입력하세요.',
    toastPasswordChangeSent: '비밀번호 변경 이메일을 발송했습니다.',
    toastTicketDone: '문의가 등록되었습니다.',
    toastNoNotif: '새 알림이 없습니다.',
    toastInitFail: '초기화 실패. 다시 시도해주세요.',
    toastEnterEmail: '이메일과 비밀번호를 입력하세요.',
    toastFillAll: '모든 필드를 입력해주세요.',
    toastPwMin: '비밀번호는 8자 이상이어야 합니다.',
    toastInvalidRef: '유효하지 않은 추천인 코드입니다.',
    toastRegDone: '회원가입 완료! 환영합니다 🎉',
    toastEmailFirst: '이메일을 먼저 입력하세요.',
    toastEnterDepAmt: '입금 금액을 입력하세요.',
    toastEnterTxid: 'TXID를 입력하세요.',
    toastEnterWithAmt: '출금 금액을 입력하세요.',
    toastEnterWithAddr: '출금 주소를 입력하세요.',
    toastEnterPin: '출금 PIN 6자리를 입력하세요.',
    toastInsufficientBal: '잔액이 부족합니다.',
    toastWrongPin: '출금 PIN이 올바르지 않습니다.',
    toastEnterInvAmt: 'FREEZE 금액을 입력하세요.',
    toastMinInvest: '최소 FREEZE 금액은 $',
    toastMaxInvest: '최대 FREEZE 금액은 $',
    toastInsufficientUsdt: 'USDT 잔액이 부족합니다.',
    toastEnterChargeAmt: '충전 금액을 입력하세요.',
    toastEnterTicket: '제목과 내용을 입력하세요.',
    logoutConfirm: '로그아웃 하시겠습니까?',
    failPrefix: '신청 실패: ',
    saveFail: '저장 실패: ',
    regFail: '등록 실패: ',
    days: '일',
    units: '건',
  },
  en: {
    authTagline: '🔐 Safe and Smart Crypto FREEZE',
    loginTab: 'Login',
    registerTab: 'Register',
    labelEmail: 'Email',
    labelPassword: 'Password',
    placeholderEmail: 'Enter your email',
    placeholderPassword: 'Enter your password',
    placeholderPasswordMin: 'At least 8 characters',
    btnLogin: 'Login',
    forgotPassword: 'Forgot your password?',
    labelName: 'Name',
    placeholderName: 'Enter your name',
    labelReferral: 'Referral Code',
    referralRequired: '* Required',
    placeholderReferral: 'Enter referral code',
    btnRegister: 'Register',
    greeting: 'Hello 👋',
    totalAssetLabel: 'Total Assets (USDT)',
    assetLocked: 'USDT Principal (Locked)',
    assetInvesting: '❄️ Freezing',
    assetInterest: 'Earnings (Withdrawable)',
    btnDeposit: 'Deposit USDT',
    btnWithdraw: 'Withdraw DDRA',
    deedraPrice: 'DDRA Current Price',
    recentUpdated: 'Updated: ',
    investingNow: '❄️ Active FREEZE',
    investAmount: 'Frozen',
    expectedReturn: 'Expected Return',
    remaining: 'Remaining',
    announcements: '📢 Announcements',
    seeAll: 'See All',
    recentTx: '💳 Recent Transactions',
    pageInvest: '❄️ FREEZE',
    activeInvest: 'Active',
    totalInvest: 'Total Invested',
    expectedReturnLabel: 'Expected Return',
    simTitle: '❄️ FREEZE Simulator',
    simSelectProduct: 'Select Product',
    simUsdtAmount: 'USDT Amount',
    simInvestAmount: 'FREEZE Amount',
    simPeriod: 'Period',
    simRoi: 'ROI',
    simEarning: 'Earnings (USDT)',
    simEarningUsd: 'Total Earnings (USDT)',
    productListTitle: '💼 Investment Products',
    myInvestTitle: '📋 My FREEZE',
    pageNetwork: '🌐 Network',
    directRef: 'Direct Refs',
    totalDownline: 'Total Downline',
    earnedBonus: 'Earned Bonus',
    myReferralCode: 'My Referral Code',
    btnCopy: 'Copy',
    btnShare: 'Share Referral Link',
    currentRank: 'Current Rank',
    nextRank: 'Next Rank: ',
    directRefCount: 'Direct Refs: ',
    orgChart: '🗂 Organization Chart',
    orgReset: 'Reset',
    orgLoading: 'Loading chart...',
    directRefList: '👥 Direct Referrals',
    pagePlay: '🎮 Play',
    gameWalletLabel: 'Game Wallet Balance',
    btnCharge: 'Charge',
    gameSelect: '🎰 Select Game',
    gameOddEven: 'Odd/Even',
    gameOddEvenDesc: '50% chance, 2x reward',
    gameDice: 'Dice',
    gameDiceDesc: 'Guess number 6x',
    gameSlot: 'Slot Machine',
    gameSlotDesc: 'Jackpot up to 50x',
    gameBaccarat: 'Baccarat',
    gameBaccaratDesc: 'Live Casino',
    gameRoulette: 'Roulette',
    gameRouletteDesc: 'Number/Color Betting',
    gamePoker: 'Poker',
    gamePokerDesc: "Texas Hold'em",
    gameSoon: 'Coming Soon',
    betAmount: '💰 Bet Amount',
    maxBalance: 'Max Balance',
    coinHint: 'Choose Odd or Even',
    choiceOdd: 'Odd',
    choiceEven: 'Even',
    gameAreaOddEven: '🪙 Odd/Even Game',
    gameAreaDice: '🎲 Dice Game',
    gameAreaSlot: '🎰 Slot Machine',
    gameAreaRoulette: '🎡 Roulette',
    rlSimpleBet: 'Simple Bet',
    rlNumberBet: 'Number Bet',
    rlSelectedBet: 'Selected Bet:',
    rlNone: 'None',
    rlSpin: 'SPIN!',
    rlRed: '🔴 Red ×2',
    rlBlack: '⚫ Black ×2',
    rlZero: '🟢 Zero ×35',
    rlOdd: 'Odd ×2',
    rlEven: 'Even ×2',
    rlLow: '1-18 ×2',
    rlHigh: '19-36 ×2',
    rlDoz1: '1-12 ×3',
    rlDoz2: '13-24 ×3',
    rlDoz3: '25-36 ×3',
    recentGameLog: '📋 Recent Game Log',
    gameStart: 'Start a game!',
    walletSection: '💰 Wallet',
    usdtBalance: 'USDT Balance',
    deedraBalance: 'DDRA Balance (Game)',
    bonusBalance: 'Earnings Balance (Withdrawable)',
    txHistory: '📊 Transaction History',
    txAll: 'All',
    txDeposit: 'Deposit',
    txWithdraw: 'Withdraw',
    txInvest: 'FREEZE',
    moreAnnouncements: '📢 Announcements',
    accountMgmt: '⚙️ Account',
    profileEdit: 'Edit Profile',
    passwordChange: 'Change Password',
    withdrawPin: 'Withdrawal PIN',
    support: 'Support',
    settings: '🔧 Settings',
    darkMode: 'Dark Mode',
    language: 'Language',
    notification: 'Notifications',
    appVersion: 'App Version',
    logout: 'Logout',
    modalDeposit: '💰 USDT Deposit Request',
    depositAddrLabel: 'Company Wallet Address (TRC20)',
    depositAddrLoading: 'Loading address...',
    depositAmountLabel: 'Deposit Amount (USDT)',
    depositTxidLabel: 'TXID (Transaction Hash)',
    depositTxidPlaceholder: 'Enter transaction hash',
    depositMemoLabel: 'Memo (Optional)',
    depositMemoPlaceholder: 'Enter memo (optional)',
    depositWarning: '⚠️ Please deposit to the address above and enter the TXID. Balance will be updated after admin approval.',
    btnCancel: 'Cancel',
    btnSubmitDeposit: 'Submit Deposit',
    modalWithdraw: '💸 DDRA Withdrawal Request',
    withdrawAvailLabel: 'Available Earnings (USDT)',
    withdrawAmountLabel: 'Withdrawal Amount (USDT)',
    withdrawAddressLabel: 'Recipient Wallet Address',
    withdrawAddressPlaceholder: 'Enter recipient address',
    withdrawPinLabel: 'Withdrawal PIN (6 digits)',
    withdrawWarning: '⚠️ Admin approval takes 1-3 business days after submission.',
    btnSubmitWithdraw: 'Submit Withdrawal',
    modalInvest: '❄️ FREEZE Request',
    investAmountLabel: 'FREEZE Amount (USDT)',
    btnSubmitInvest: 'FREEZE',
    modalCharge: '🎮 Charge Game Wallet',
    chargeInfoLabel: 'Transfer from DDRA balance to game wallet',
    chargeHolding: 'Balance: ',
    chargeAmountLabel: 'Charge Amount (DDRA)',
    btnSubmitCharge: 'Charge',
    modalPin: '🔐 Set Withdrawal PIN',
    newPinLabel: 'New PIN (6 digits)',
    confirmPinLabel: 'Confirm PIN',
    btnSave: 'Save',
    modalProfile: '✏️ Edit Profile',
    labelPhone: 'Phone',
    placeholderPhone: '000-0000-0000',
    modalTicket: '💬 Support',
    ticketTitleLabel: 'Title',
    ticketTitlePlaceholder: 'Inquiry title',
    ticketContentLabel: 'Content',
    ticketContentPlaceholder: 'Enter inquiry content',
    btnClose: 'Close',
    btnSubmitTicket: 'Submit',
    modalAnnouncement: '📢 Announcements',
    toastCopied: 'Copied!',
    toastShared: 'Link shared!',
    toastLinkCopied: 'Link copied!',
    toastPasswordReset: 'Password reset email sent',
    toastPinSuccess: 'PIN has been set',
    toastSettingFail: 'Failed to save settings',
    toastProfileSaved: 'Profile saved',
    toastLogoutSuccess: 'Logged out',
    toastAddrCopied: 'Address copied!',
    toastRefCodeCopied: 'Referral code copied!',
    toastInviteLinkCopied: 'Invite link copied!',
    toastDepositDone: 'Deposit request submitted! Waiting for admin approval.',
    toastWithdrawDone: 'Withdrawal request submitted! Processing takes 1-3 business days.',
    toastInvestDone: 'FREEZE submitted! ❄️🎉',
    toastChargeDone: ' DDRA charged!',
    toastGameChargeFirst: 'Please charge your game wallet first.',
    toastNoBalance: 'Insufficient balance',
    toastSelectBet: 'Please select a bet first.',
    toastEnterName: 'Please enter your name.',
    toastPinMismatch: 'PIN does not match.',
    toastPinDigit: 'Please enter 6 digits.',
    toastPinLen: 'Please enter a 6-digit PIN.',
    toastPasswordChangeSent: 'Password change email sent.',
    toastTicketDone: 'Inquiry submitted.',
    toastNoNotif: 'No new notifications.',
    toastInitFail: 'Initialization failed. Please try again.',
    toastEnterEmail: 'Please enter email and password.',
    toastFillAll: 'Please fill all fields.',
    toastPwMin: 'Password must be at least 8 characters.',
    toastInvalidRef: 'Invalid referral code.',
    toastRegDone: 'Registration complete! Welcome 🎉',
    toastEmailFirst: 'Please enter your email first.',
    toastEnterDepAmt: 'Please enter deposit amount.',
    toastEnterTxid: 'Please enter TXID.',
    toastEnterWithAmt: 'Please enter withdrawal amount.',
    toastEnterWithAddr: 'Please enter withdrawal address.',
    toastEnterPin: 'Please enter 6-digit withdrawal PIN.',
    toastInsufficientBal: 'Insufficient balance.',
    toastWrongPin: 'Incorrect withdrawal PIN.',
    toastEnterInvAmt: 'Please enter investment amount.',
    toastMinInvest: 'Minimum FREEZE is $',
    toastMaxInvest: 'Maximum FREEZE is $',
    toastInsufficientUsdt: 'Insufficient USDT balance.',
    toastEnterChargeAmt: 'Please enter charge amount.',
    toastEnterTicket: 'Please enter title and content.',
    logoutConfirm: 'Are you sure you want to logout?',
    failPrefix: 'Failed: ',
    saveFail: 'Save failed: ',
    regFail: 'Registration failed: ',
    days: ' days',
    units: '',
  },
  vi: {
    authTagline: '🔐 Đầu tư tiền điện tử an toàn & thông minh',
    loginTab: 'Đăng nhập',
    registerTab: 'Đăng ký',
    labelEmail: 'Email',
    labelPassword: 'Mật khẩu',
    placeholderEmail: 'Nhập email của bạn',
    placeholderPassword: 'Nhập mật khẩu',
    placeholderPasswordMin: 'Tối thiểu 8 ký tự',
    btnLogin: 'Đăng nhập',
    forgotPassword: 'Quên mật khẩu?',
    labelName: 'Họ tên',
    placeholderName: 'Nhập họ tên',
    labelReferral: 'Mã giới thiệu',
    referralRequired: '* Bắt buộc',
    placeholderReferral: 'Nhập mã giới thiệu',
    btnRegister: 'Đăng ký',
    greeting: 'Xin chào 👋',
    totalAssetLabel: 'Tổng tài sản (USDT)',
    assetLocked: 'Gốc USDT (Đang khóa)',
    assetInvesting: 'Đang đầu tư',
    assetInterest: 'Thu nhập (Có thể rút)',
    btnDeposit: 'Nạp USDT',
    btnWithdraw: 'Rút DDRA',
    deedraPrice: 'Giá DDRA hiện tại',
    recentUpdated: 'Cập nhật: ',
    investingNow: '📈 Đầu tư đang hoạt động',
    investAmount: 'Đầu tư',
    expectedReturn: 'Lợi nhuận dự kiến',
    remaining: 'Còn lại',
    announcements: '📢 Thông báo',
    seeAll: 'Xem tất cả',
    recentTx: '💳 Giao dịch gần đây',
    pageInvest: '📈 Đầu tư',
    activeInvest: 'Đang hoạt động',
    totalInvest: 'Tổng đầu tư',
    expectedReturnLabel: 'Lợi nhuận dự kiến',
    simTitle: 'Máy tính lợi nhuận',
    simSelectProduct: 'Chọn sản phẩm',
    simUsdtAmount: 'Số tiền USDT',
    simInvestAmount: 'Số tiền đầu tư',
    simPeriod: 'Thời gian',
    simRoi: 'ROI',
    simEarning: 'Thu nhập (USDT)',
    simEarningUsd: 'Thu nhập tổng cộng (USDT)',
    productListTitle: '💼 Sản phẩm đầu tư',
    myInvestTitle: '📋 Đầu tư của tôi',
    pageNetwork: '🌐 Mạng lưới',
    directRef: 'Giới thiệu trực tiếp',
    totalDownline: 'Tổng hạ tầng',
    earnedBonus: 'Tiền thưởng',
    myReferralCode: 'Mã giới thiệu của tôi',
    btnCopy: 'Sao chép',
    btnShare: 'Chia sẻ liên kết',
    currentRank: 'Hạng hiện tại',
    nextRank: 'Hạng tiếp theo: ',
    directRefCount: 'Giới thiệu trực tiếp: ',
    orgChart: '🗂 Sơ đồ tổ chức',
    orgReset: 'Đặt lại',
    orgLoading: 'Đang tải sơ đồ...',
    directRefList: '👥 Danh sách giới thiệu',
    pagePlay: '🎮 Chơi game',
    gameWalletLabel: 'Số dư ví game',
    btnCharge: 'Nạp',
    gameSelect: '🎰 Chọn game',
    gameOddEven: 'Lẻ/Chẵn',
    gameOddEvenDesc: 'Xác suất 50%, thưởng 2x',
    gameDice: 'Xúc xắc',
    gameDiceDesc: 'Đoán số thắng 6x',
    gameSlot: 'Máy đánh bạc',
    gameSlotDesc: 'Jackpot tối đa 50x',
    gameBaccarat: 'Baccarat',
    gameBaccaratDesc: 'Casino trực tiếp',
    gameRoulette: 'Roulette',
    gameRouletteDesc: 'Cược số/màu',
    gamePoker: 'Poker',
    gamePokerDesc: 'Texas Holdem',
    gameSoon: 'Sắp ra mắt',
    betAmount: '💰 Số tiền cược',
    maxBalance: 'Số dư tối đa',
    coinHint: 'Chọn Lẻ hoặc Chẵn',
    choiceOdd: 'Lẻ (Odd)',
    choiceEven: 'Chẵn (Even)',
    gameAreaOddEven: '🪙 Game Lẻ/Chẵn',
    gameAreaDice: '🎲 Game Xúc xắc',
    gameAreaSlot: '🎰 Máy đánh bạc',
    gameAreaRoulette: '🎡 Roulette',
    rlSimpleBet: 'Cược đơn giản',
    rlNumberBet: 'Cược số',
    rlSelectedBet: 'Cược đã chọn:',
    rlNone: 'Chưa chọn',
    rlSpin: 'QUAY!',
    rlRed: '🔴 Đỏ ×2',
    rlBlack: '⚫ Đen ×2',
    rlZero: '🟢 Không ×35',
    rlOdd: 'Lẻ ×2',
    rlEven: 'Chẵn ×2',
    rlLow: '1-18 ×2',
    rlHigh: '19-36 ×2',
    rlDoz1: '1-12 ×3',
    rlDoz2: '13-24 ×3',
    rlDoz3: '25-36 ×3',
    recentGameLog: '📋 Lịch sử game gần đây',
    gameStart: 'Bắt đầu chơi game!',
    walletSection: '💰 Ví',
    usdtBalance: 'Số dư USDT',
    deedraBalance: 'Số dư DEEDRA',
    bonusBalance: 'Số dư thưởng',
    txHistory: '📊 Lịch sử giao dịch',
    txAll: 'Tất cả',
    txDeposit: 'Nạp tiền',
    txWithdraw: 'Rút tiền',
    txInvest: 'Đầu tư',
    moreAnnouncements: '📢 Thông báo',
    accountMgmt: '⚙️ Tài khoản',
    profileEdit: 'Sửa hồ sơ',
    passwordChange: 'Đổi mật khẩu',
    withdrawPin: 'PIN rút tiền',
    support: 'Hỗ trợ',
    settings: '🔧 Cài đặt',
    darkMode: 'Chế độ tối',
    language: 'Ngôn ngữ',
    notification: 'Thông báo',
    appVersion: 'Phiên bản',
    logout: 'Đăng xuất',
    modalDeposit: '💰 Yêu cầu nạp USDT',
    depositAddrLabel: 'Địa chỉ ví công ty (TRC20)',
    depositAddrLoading: 'Đang tải địa chỉ...',
    depositAmountLabel: 'Số tiền nạp (USDT)',
    depositTxidLabel: 'TXID (Mã giao dịch)',
    depositTxidPlaceholder: 'Nhập mã giao dịch',
    depositMemoLabel: 'Ghi chú (Tùy chọn)',
    depositMemoPlaceholder: 'Nhập ghi chú (tùy chọn)',
    depositWarning: '⚠️ Vui lòng nạp vào địa chỉ trên và nhập TXID. Số dư sẽ được cập nhật sau khi admin duyệt.',
    btnCancel: 'Hủy',
    btnSubmitDeposit: 'Gửi yêu cầu',
    modalWithdraw: '💸 Yêu cầu rút DEEDRA',
    withdrawAvailLabel: 'Số dư có thể rút',
    withdrawAmountLabel: 'Số tiền rút (DEEDRA)',
    withdrawAddressLabel: 'Địa chỉ ví nhận',
    withdrawAddressPlaceholder: 'Nhập địa chỉ ví nhận',
    withdrawPinLabel: 'PIN rút tiền (6 chữ số)',
    withdrawWarning: '⚠️ Phê duyệt của admin mất 1-3 ngày làm việc.',
    btnSubmitWithdraw: 'Gửi yêu cầu rút',
    modalInvest: '📈 Yêu cầu đầu tư',
    investAmountLabel: 'Số tiền đầu tư (USDT)',
    btnSubmitInvest: 'Xác nhận đầu tư',
    modalCharge: '🎮 Nạp ví game',
    chargeInfoLabel: 'Chuyển từ DEEDRA sang ví game',
    chargeHolding: 'Số dư: ',
    chargeAmountLabel: 'Số tiền nạp (DEEDRA)',
    btnSubmitCharge: 'Nạp',
    modalPin: '🔐 Cài đặt PIN rút tiền',
    newPinLabel: 'PIN mới (6 chữ số)',
    confirmPinLabel: 'Xác nhận PIN',
    btnSave: 'Lưu',
    modalProfile: '✏️ Sửa hồ sơ',
    labelPhone: 'Điện thoại',
    placeholderPhone: '000-0000-0000',
    modalTicket: '💬 Hỗ trợ',
    ticketTitleLabel: 'Tiêu đề',
    ticketTitlePlaceholder: 'Tiêu đề câu hỏi',
    ticketContentLabel: 'Nội dung',
    ticketContentPlaceholder: 'Nhập nội dung câu hỏi',
    btnClose: 'Đóng',
    btnSubmitTicket: 'Gửi',
    modalAnnouncement: '📢 Thông báo',
    toastCopied: 'Đã sao chép!',
    toastShared: 'Đã chia sẻ liên kết!',
    toastLinkCopied: 'Đã sao chép liên kết!',
    toastPasswordReset: 'Email đặt lại mật khẩu đã được gửi',
    toastPinSuccess: 'PIN đã được cài đặt',
    toastSettingFail: 'Lưu cài đặt thất bại',
    toastProfileSaved: 'Đã lưu hồ sơ',
    toastLogoutSuccess: 'Đã đăng xuất',
    toastAddrCopied: 'Đã sao chép địa chỉ!',
    toastRefCodeCopied: 'Đã sao chép mã giới thiệu!',
    toastInviteLinkCopied: 'Đã sao chép liên kết mời!',
    toastDepositDone: 'Yêu cầu nạp tiền đã gửi! Chờ admin duyệt.',
    toastWithdrawDone: 'Yêu cầu rút tiền đã gửi! Mất 1-3 ngày làm việc.',
    toastInvestDone: 'Yêu cầu đầu tư đã gửi! 🎉',
    toastChargeDone: ' DEEDRA đã nạp!',
    toastGameChargeFirst: 'Vui lòng nạp ví game trước.',
    toastNoBalance: 'Số dư không đủ',
    toastSelectBet: 'Vui lòng chọn cược trước.',
    toastEnterName: 'Vui lòng nhập tên.',
    toastPinMismatch: 'PIN không khớp.',
    toastPinDigit: 'Vui lòng nhập 6 chữ số.',
    toastPinLen: 'Vui lòng nhập PIN 6 chữ số.',
    toastPasswordChangeSent: 'Email đổi mật khẩu đã được gửi.',
    toastTicketDone: 'Câu hỏi đã được gửi.',
    toastNoNotif: 'Không có thông báo mới.',
    toastInitFail: 'Khởi tạo thất bại. Vui lòng thử lại.',
    toastEnterEmail: 'Vui lòng nhập email và mật khẩu.',
    toastFillAll: 'Vui lòng điền tất cả các trường.',
    toastPwMin: 'Mật khẩu phải ít nhất 8 ký tự.',
    toastInvalidRef: 'Mã giới thiệu không hợp lệ.',
    toastRegDone: 'Đăng ký thành công! Chào mừng 🎉',
    toastEmailFirst: 'Vui lòng nhập email trước.',
    toastEnterDepAmt: 'Vui lòng nhập số tiền nạp.',
    toastEnterTxid: 'Vui lòng nhập TXID.',
    toastEnterWithAmt: 'Vui lòng nhập số tiền rút.',
    toastEnterWithAddr: 'Vui lòng nhập địa chỉ rút.',
    toastEnterPin: 'Vui lòng nhập PIN rút 6 chữ số.',
    toastInsufficientBal: 'Số dư không đủ.',
    toastWrongPin: 'PIN rút không đúng.',
    toastEnterInvAmt: 'Vui lòng nhập số tiền đầu tư.',
    toastMinInvest: 'Đầu tư tối thiểu là $',
    toastMaxInvest: 'Đầu tư tối đa là $',
    toastInsufficientUsdt: 'Số dư USDT không đủ.',
    toastEnterChargeAmt: 'Vui lòng nhập số tiền nạp.',
    toastEnterTicket: 'Vui lòng nhập tiêu đề và nội dung.',
    logoutConfirm: 'Bạn có chắc muốn đăng xuất?',
    failPrefix: 'Thất bại: ',
    saveFail: 'Lưu thất bại: ',
    regFail: 'Đăng ký thất bại: ',
    days: ' ngày',
    units: '',
  },
  th: {
    authTagline: '🔐 ลงทุนคริปโตอย่างปลอดภัยและชาญฉลาด',
    loginTab: 'เข้าสู่ระบบ',
    registerTab: 'สมัครสมาชิก',
    labelEmail: 'อีเมล',
    labelPassword: 'รหัสผ่าน',
    placeholderEmail: 'กรอกอีเมลของคุณ',
    placeholderPassword: 'กรอกรหัสผ่าน',
    placeholderPasswordMin: 'อย่างน้อย 8 ตัวอักษร',
    btnLogin: 'เข้าสู่ระบบ',
    forgotPassword: 'ลืมรหัสผ่าน?',
    labelName: 'ชื่อ',
    placeholderName: 'กรอกชื่อของคุณ',
    labelReferral: 'รหัสแนะนำ',
    referralRequired: '* จำเป็น',
    placeholderReferral: 'กรอกรหัสแนะนำ',
    btnRegister: 'สมัครสมาชิก',
    greeting: 'สวัสดี 👋',
    totalAssetLabel: 'สินทรัพย์รวม (USDT)',
    assetLocked: 'เงินต้น USDT (ล็อค)',
    assetInvesting: 'กำลังลงทุน',
    assetInterest: 'รายได้ (ถอนได้)',
    btnDeposit: 'ฝาก USDT',
    btnWithdraw: 'ถอน DDRA',
    deedraPrice: 'ราคา DDRA ปัจจุบัน',
    recentUpdated: 'อัปเดต: ',
    investingNow: '📈 การลงทุนที่กำลังดำเนินการ',
    investAmount: 'ลงทุน',
    expectedReturn: 'ผลตอบแทนที่คาดหวัง',
    remaining: 'เหลือ',
    announcements: '📢 ประกาศ',
    seeAll: 'ดูทั้งหมด',
    recentTx: '💳 รายการล่าสุด',
    pageInvest: '📈 ลงทุน',
    activeInvest: 'กำลังดำเนินการ',
    totalInvest: 'ลงทุนรวม',
    expectedReturnLabel: 'ผลตอบแทนที่คาดหวัง',
    simTitle: 'เครื่องคำนวณผลตอบแทน',
    simSelectProduct: 'เลือกผลิตภัณฑ์',
    simUsdtAmount: 'จำนวน USDT',
    simInvestAmount: 'จำนวนเงินลงทุน',
    simPeriod: 'ระยะเวลา',
    simRoi: 'ROI',
    simEarning: 'รายได้ (USDT)',
    simEarningUsd: 'รายได้รวม (USDT)',
    productListTitle: '💼 ผลิตภัณฑ์การลงทุน',
    myInvestTitle: '📋 การลงทุนของฉัน',
    pageNetwork: '🌐 เครือข่าย',
    directRef: 'แนะนำโดยตรง',
    totalDownline: 'เครือข่ายทั้งหมด',
    earnedBonus: 'โบนัสที่ได้รับ',
    myReferralCode: 'รหัสแนะนำของฉัน',
    btnCopy: 'คัดลอก',
    btnShare: 'แชร์ลิงก์แนะนำ',
    currentRank: 'อันดับปัจจุบัน',
    nextRank: 'อันดับถัดไป: ',
    directRefCount: 'แนะนำโดยตรง: ',
    orgChart: '🗂 แผนผังองค์กร',
    orgReset: 'รีเซ็ต',
    orgLoading: 'กำลังโหลดแผนผัง...',
    directRefList: '👥 รายชื่อผู้แนะนำ',
    pagePlay: '🎮 เล่นเกม',
    gameWalletLabel: 'ยอดคงเหลือในกระเป๋าเกม',
    btnCharge: 'เติมเงิน',
    gameSelect: '🎰 เลือกเกม',
    gameOddEven: 'คี่/คู่',
    gameOddEvenDesc: 'โอกาส 50%, รางวัล 2x',
    gameDice: 'ลูกเต๋า',
    gameDiceDesc: 'ทายตัวเลข ชนะ 6x',
    gameSlot: 'สล็อตแมชชีน',
    gameSlotDesc: 'แจ็คพอตสูงสุด 50x',
    gameBaccarat: 'บาคาร่า',
    gameBaccaratDesc: 'คาสิโนสด',
    gameRoulette: 'รูเล็ต',
    gameRouletteDesc: 'เดิมพันตัวเลข/สี',
    gamePoker: 'โป๊กเกอร์',
    gamePokerDesc: 'เท็กซัส โฮลเดม',
    gameSoon: 'เร็วๆ นี้',
    betAmount: '💰 จำนวนเดิมพัน',
    maxBalance: 'ยอดสูงสุด',
    coinHint: 'เลือก คี่ หรือ คู่',
    choiceOdd: 'คี่ (Odd)',
    choiceEven: 'คู่ (Even)',
    gameAreaOddEven: '🪙 เกมคี่/คู่',
    gameAreaDice: '🎲 เกมลูกเต๋า',
    gameAreaSlot: '🎰 สล็อตแมชชีน',
    gameAreaRoulette: '🎡 รูเล็ต',
    rlSimpleBet: 'เดิมพันง่าย',
    rlNumberBet: 'เดิมพันตัวเลข',
    rlSelectedBet: 'เดิมพันที่เลือก:',
    rlNone: 'ยังไม่เลือก',
    rlSpin: 'หมุน!',
    rlRed: '🔴 แดง ×2',
    rlBlack: '⚫ ดำ ×2',
    rlZero: '🟢 ศูนย์ ×35',
    rlOdd: 'คี่ ×2',
    rlEven: 'คู่ ×2',
    rlLow: '1-18 ×2',
    rlHigh: '19-36 ×2',
    rlDoz1: '1-12 ×3',
    rlDoz2: '13-24 ×3',
    rlDoz3: '25-36 ×3',
    recentGameLog: '📋 บันทึกเกมล่าสุด',
    gameStart: 'เริ่มเล่นเกม!',
    walletSection: '💰 กระเป๋าเงิน',
    usdtBalance: 'ยอด USDT',
    deedraBalance: 'ยอด DDRA (Game)',
    bonusBalance: 'รายได้ (ถอนได้)',
    txHistory: '📊 ประวัติรายการ',
    txAll: 'ทั้งหมด',
    txDeposit: 'ฝาก',
    txWithdraw: 'ถอน',
    txInvest: 'ลงทุน',
    moreAnnouncements: '📢 ประกาศ',
    accountMgmt: '⚙️ บัญชี',
    profileEdit: 'แก้ไขโปรไฟล์',
    passwordChange: 'เปลี่ยนรหัสผ่าน',
    withdrawPin: 'PIN ถอนเงิน',
    support: 'ติดต่อสนับสนุน',
    settings: '🔧 ตั้งค่า',
    darkMode: 'โหมดมืด',
    language: 'ภาษา',
    notification: 'การแจ้งเตือน',
    appVersion: 'เวอร์ชัน',
    logout: 'ออกจากระบบ',
    modalDeposit: '💰 คำขอฝาก USDT',
    depositAddrLabel: 'ที่อยู่กระเป๋าบริษัท (TRC20)',
    depositAddrLoading: 'กำลังโหลดที่อยู่...',
    depositAmountLabel: 'จำนวนเงินฝาก (USDT)',
    depositTxidLabel: 'TXID (แฮชธุรกรรม)',
    depositTxidPlaceholder: 'กรอกแฮชธุรกรรม',
    depositMemoLabel: 'บันทึก (ไม่บังคับ)',
    depositMemoPlaceholder: 'กรอกบันทึก (ไม่บังคับ)',
    depositWarning: '⚠️ กรุณาฝากไปยังที่อยู่ด้านบนแล้วกรอก TXID ยอดจะอัปเดตหลังจากผู้ดูแลอนุมัติ',
    btnCancel: 'ยกเลิก',
    btnSubmitDeposit: 'ส่งคำขอฝาก',
    modalWithdraw: '💸 คำขอถอน DDRA',
    withdrawAvailLabel: 'รายได้ที่ถอนได้ (USDT)',
    withdrawAmountLabel: 'จำนวนที่ถอน (USDT)',
    withdrawAddressLabel: 'ที่อยู่กระเป๋าผู้รับ',
    withdrawAddressPlaceholder: 'กรอกที่อยู่กระเป๋าผู้รับ',
    withdrawPinLabel: 'PIN ถอนเงิน (6 หลัก)',
    withdrawWarning: '⚠️ การอนุมัติของผู้ดูแลใช้เวลา 1-3 วันทำการ',
    btnSubmitWithdraw: 'ส่งคำขอถอน',
    modalInvest: '📈 คำขอลงทุน',
    investAmountLabel: 'จำนวนเงินลงทุน (USDT)',
    btnSubmitInvest: 'ยืนยันการลงทุน',
    modalCharge: '🎮 เติมเงินกระเป๋าเกม',
    chargeInfoLabel: 'โอนจาก DDRA ไปยังกระเป๋าเกม',
    chargeHolding: 'ยอด: ',
    chargeAmountLabel: 'จำนวนเติมเงิน (DDRA)',
    btnSubmitCharge: 'เติมเงิน',
    modalPin: '🔐 ตั้ง PIN ถอนเงิน',
    newPinLabel: 'PIN ใหม่ (6 หลัก)',
    confirmPinLabel: 'ยืนยัน PIN',
    btnSave: 'บันทึก',
    modalProfile: '✏️ แก้ไขโปรไฟล์',
    labelPhone: 'โทรศัพท์',
    placeholderPhone: '000-000-0000',
    modalTicket: '💬 ติดต่อสนับสนุน',
    ticketTitleLabel: 'หัวข้อ',
    ticketTitlePlaceholder: 'หัวข้อคำถาม',
    ticketContentLabel: 'เนื้อหา',
    ticketContentPlaceholder: 'กรอกเนื้อหาคำถาม',
    btnClose: 'ปิด',
    btnSubmitTicket: 'ส่ง',
    modalAnnouncement: '📢 ประกาศ',
    toastCopied: 'คัดลอกแล้ว!',
    toastShared: 'แชร์ลิงก์แล้ว!',
    toastLinkCopied: 'คัดลอกลิงก์แล้ว!',
    toastPasswordReset: 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว',
    toastPinSuccess: 'ตั้ง PIN สำเร็จ',
    toastSettingFail: 'บันทึกการตั้งค่าล้มเหลว',
    toastProfileSaved: 'บันทึกโปรไฟล์แล้ว',
    toastLogoutSuccess: 'ออกจากระบบแล้ว',
    toastAddrCopied: 'คัดลอกที่อยู่แล้ว!',
    toastRefCodeCopied: 'คัดลอกรหัสแนะนำแล้ว!',
    toastInviteLinkCopied: 'คัดลอกลิงก์เชิญแล้ว!',
    toastDepositDone: 'ส่งคำขอฝากแล้ว! รอการอนุมัติจาก admin',
    toastWithdrawDone: 'ส่งคำขอถอนแล้ว! ใช้เวลา 1-3 วันทำการ',
    toastInvestDone: 'ส่งคำขอลงทุนแล้ว! 🎉',
    toastChargeDone: ' DEEDRA เติมแล้ว!',
    toastGameChargeFirst: 'กรุณาเติมเงินกระเป๋าเกมก่อน',
    toastNoBalance: 'ยอดไม่เพียงพอ',
    toastSelectBet: 'กรุณาเลือกการเดิมพันก่อน',
    toastEnterName: 'กรุณากรอกชื่อ',
    toastPinMismatch: 'PIN ไม่ตรงกัน',
    toastPinDigit: 'กรุณากรอก 6 หลัก',
    toastPinLen: 'กรุณากรอก PIN 6 หลัก',
    toastPasswordChangeSent: 'ส่งอีเมลเปลี่ยนรหัสผ่านแล้ว',
    toastTicketDone: 'ส่งคำถามแล้ว',
    toastNoNotif: 'ไม่มีการแจ้งเตือนใหม่',
    toastInitFail: 'เริ่มต้นล้มเหลว กรุณาลองใหม่',
    toastEnterEmail: 'กรุณากรอกอีเมลและรหัสผ่าน',
    toastFillAll: 'กรุณากรอกข้อมูลทุกช่อง',
    toastPwMin: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
    toastInvalidRef: 'รหัสแนะนำไม่ถูกต้อง',
    toastRegDone: 'สมัครสมาชิกสำเร็จ! ยินดีต้อนรับ 🎉',
    toastEmailFirst: 'กรุณากรอกอีเมลก่อน',
    toastEnterDepAmt: 'กรุณากรอกจำนวนเงินฝาก',
    toastEnterTxid: 'กรุณากรอก TXID',
    toastEnterWithAmt: 'กรุณากรอกจำนวนเงินถอน',
    toastEnterWithAddr: 'กรุณากรอกที่อยู่ถอน',
    toastEnterPin: 'กรุณากรอก PIN ถอน 6 หลัก',
    toastInsufficientBal: 'ยอดไม่เพียงพอ',
    toastWrongPin: 'PIN ถอนไม่ถูกต้อง',
    toastEnterInvAmt: 'กรุณากรอกจำนวนเงินลงทุน',
    toastMinInvest: 'ลงทุนขั้นต่ำคือ $',
    toastMaxInvest: 'ลงทุนสูงสุดคือ $',
    toastInsufficientUsdt: 'ยอด USDT ไม่เพียงพอ',
    toastEnterChargeAmt: 'กรุณากรอกจำนวนเงินเติม',
    toastEnterTicket: 'กรุณากรอกหัวข้อและเนื้อหา',
    logoutConfirm: 'คุณแน่ใจว่าต้องการออกจากระบบ?',
    failPrefix: 'ล้มเหลว: ',
    saveFail: 'บันทึกล้มเหลว: ',
    regFail: 'ลงทะเบียนล้มเหลว: ',
    days: ' วัน',
    units: '',
  }
};

// ===== i18n 헬퍼 =====
let currentLang = 'ko';

function detectSystemLang() {
  const nav = navigator.language || navigator.userLanguage || 'ko';
  const base = nav.split('-')[0].toLowerCase();
  if (base === 'vi') return 'vi';
  if (base === 'th') return 'th';
  if (base === 'en') return 'en';
  if (base === 'ko') return 'ko';
  // 지원하지 않는 언어이면 영어로 폴백
  return 'en';
}

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) ||
         (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) || key;
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) {
      el.setAttribute(attr, t(key));
    } else {
      el.textContent = t(key);
    }
  });
  // HTML lang 속성 업데이트
  document.documentElement.setAttribute('lang', currentLang);
  // 언어 선택 드롭다운 동기화
  const sel = document.querySelector('.lang-select');
  if (sel) sel.value = currentLang;
  // localStorage 저장
  localStorage.setItem('deedra_lang', currentLang);
}

// ===== 전역 상태 =====
let currentUser = null;
let userData = null;
let walletData = null;
let currentPage = 'home';
let selectedProduct = null;
// gameBalanceVal = bonusBalance(USDT) 직접 미러링 - 별도 게임지갑 없음
let gameBalanceVal = 0;
let oeBetVal = 10;
let diceBetVal = 10;
let slotBetVal = 10;
let rlBetVal   = 10;   // 룰렛 베팅
let bacBetVal  = 10;   // 바카라 베팅
let pkBetVal   = 10;   // 포커 베팅
let rlSelectedBet = null; // 룰렛 선택 베팅 유형
let deedraPrice = 0.50; // DEEDRA 시세 (관리자 설정값)
let currentTheme = 'dark';
let productsCache = [];

// 직급 체계 (기본값 - 관리자 설정이 없을 때 사용)
const RANKS = [
  { rank: 'G0', minRefs: 0, label: 'Bronze' },
  { rank: 'G1', minRefs: 3, label: 'Silver' },
  { rank: 'G2', minRefs: 10, label: 'Gold' },
  { rank: 'G3', minRefs: 20, label: 'Platinum' },
  { rank: 'G4', minRefs: 40, label: 'Diamond' },
  { rank: 'G5', minRefs: 80, label: 'Master' },
  { rank: 'G6', minRefs: 150, label: 'Grand Master' },
  { rank: 'G7', minRefs: 300, label: 'Legend' },
  { rank: 'G8', minRefs: 600, label: 'Mythic' },
  { rank: 'G9', minRefs: 1200, label: 'Elite' },
  { rank: 'G10', minRefs: 2000, label: 'Founder' },
];

// 관리자가 설정한 직급 승진 조건 (Firestore에서 로드)
let rankPromoSettings = null;

// ===== 게임 하우스 확률 (관리자 설정) =====
// houseWinRate: 0~100 → 관리자(하우스)가 이기는 확률 %
// 0% = 하우스가 절대 못 이김(유저 유리), 100% = 하우스가 항상 이김(유저 항상 패)
// 기본값은 각 게임별 정상 RTP 기반 (홀짝 4%, 주사위 6%, 슬롯 8%, 룰렛 2.7%, 바카라 1.1%, 포커 1%)
let gameOdds = {
  global:   { houseWinRate: 4 },   // 전체 게임 공통 (개별 설정이 없을 때 사용)
  oddeven:  { houseWinRate: 4 },
  dice:     { houseWinRate: 6 },
  slot:     { houseWinRate: 8 },
  roulette: { houseWinRate: 3 },
  baccarat: { houseWinRate: 1 },
  poker:    { houseWinRate: 1 },
};
let gameOddsLoaded = false;

// Firestore에서 게임 확률 설정 로드
async function loadGameOdds() {
  try {
    const { doc, getDoc, db } = window.FB;
    const snap = await getDoc(doc(db, 'settings', 'gameOdds'));
    if (snap.exists()) {
      const data = snap.data();
      // 필드명: oddeven_win = 유저 승률 → houseWinRate = 100 - win
      const keys = ['oddeven','dice','slot','roulette','baccarat','poker'];
      keys.forEach(k => {
        const win = data[k + '_win'];
        if (win !== undefined) {
          gameOdds[k].houseWinRate = 100 - Number(win);
        }
      });
    }
    gameOddsLoaded = true;
  } catch(e) {
    console.warn('[GameOdds] 설정 로드 실패, 기본값 사용:', e);
    gameOddsLoaded = true;
  }
}

// 하우스 확률 적용 랜덤 함수
// gameKey: 'oddeven' | 'dice' | 'slot' | 'roulette' | 'baccarat' | 'poker'
// 반환: true = 유저 승리, false = 유저 패배
function houseRandom(gameKey) {
  const rate = gameOdds[gameKey]?.houseWinRate ?? gameOdds.global.houseWinRate;
  // rate = 하우스(관리자)가 이기는 확률 (0~100%)
  // 즉 유저가 이길 확률 = (100 - rate) / 100
  return Math.random() * 100 >= rate;  // true → 유저 승리
}

const SLOT_SYMBOLS = ['🍋', '🍇', '🍎', '🍊', '⭐', '7️⃣', '💎'];
const DICE_FACES = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

// 주사위 점 배치 패턴 (3x3 grid, 인덱스 0~8)
const DICE_DOT_PATTERNS = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

// 주사위 점 렌더링
function renderDiceDots(num) {
  const dotsEl = document.getElementById('diceDots');
  if (!dotsEl) return;
  const pattern = DICE_DOT_PATTERNS[num] || [];
  dotsEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement('div');
    dot.className = pattern.includes(i) ? 'dice-dot' : 'dice-dot empty';
    dotsEl.appendChild(dot);
  }
}

// 잭팟 파티클 생성
function spawnJackpotParticles() {
  const container = document.createElement('div');
  container.className = 'jackpot-particles';
  document.body.appendChild(container);
  const emojis = ['🎉', '✨', '💎', '⭐', '🌟', '💰', '🎊', '🥇'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'jackpot-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDelay = Math.random() * 1 + 's';
    p.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
    p.style.fontSize = (14 + Math.random() * 16) + 'px';
    container.appendChild(p);
  }
  setTimeout(() => container.remove(), 3500);
}

// USD → KRW 환율 (고정)
const USD_KRW = 1350;

// ===== 언어 초기화 (앱 시작 시 즉시 실행) =====
(function initLang() {
  const saved = localStorage.getItem('deedra_lang');
  if (saved && TRANSLATIONS[saved]) {
    currentLang = saved;
  } else {
    currentLang = detectSystemLang();
  }
  // DOM이 준비되면 번역 적용
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLang);
  } else {
    applyLang();
  }
})();

// ===== 앱 초기화 =====
window.onAuthReady = async (user) => {
  if (user) {
    currentUser = user;
    await initApp();
  } else {
    showScreen('auth');
  }
};

async function initApp() {
  try {
    const { doc, getDoc, db } = window.FB;
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));

    if (!userSnap.exists()) {
      await createUserData(currentUser);
    } else {
      userData = userSnap.data();
    }

    // 직급 승진 조건 설정 로드 (에러 무시)
    try {
      const promoSnap = await getDoc(doc(db, 'settings', 'rankPromotion'));
      if (promoSnap.exists()) rankPromoSettings = promoSnap.data();
    } catch(e) { /* 설정 없으면 기본값 사용 */ }

    await loadWalletData();
    await loadDeedraPrice();
    await loadGameOdds();

    showScreen('main');

    updateHomeUI();
    loadAnnouncements();
    loadRecentTransactions();
    loadDDayCard();
    loadHomeEarn();
    startNotificationListener();

    // 테마 복원
    restoreTheme();
    // 언어 재적용 (동적 렌더링 후)
    applyLang();

  } catch (err) {
    console.error('앱 초기화 실패:', err);
    showToast('초기화 실패. 다시 시도해주세요.', 'error');
    showScreen('auth');
  }
}

async function createUserData(user) {
  const { doc, setDoc, db, serverTimestamp } = window.FB;
  const referralCode = generateReferralCode(user.uid);

  userData = {
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email.split('@')[0],
    role: 'member',
    rank: 'G0',
    status: 'active',
    referralCode,
    referredBy: null,
    createdAt: serverTimestamp(),
    phone: '',
    withdrawPin: null,
  };

  await setDoc(doc(db, 'users', user.uid), userData);
  await setDoc(doc(db, 'wallets', user.uid), {
    userId: user.uid,
    usdtBalance: 0,
    dedraBalance: 0,
    bonusBalance: 0,
    totalDeposit: 0,
    totalWithdrawal: 0,
    totalEarnings: 0,
    createdAt: serverTimestamp(),
  });
}

async function loadWalletData() {
  const { doc, getDoc, db } = window.FB;
  const snap = await getDoc(doc(db, 'wallets', currentUser.uid));
  walletData = snap.exists() ? snap.data() : { usdtBalance: 0, dedraBalance: 0, bonusBalance: 0 };
  // 게임 잔액 = 수익 잔액(bonusBalance) ÷ deedraPrice = DDRA 단위
  gameBalanceVal = Math.floor(((walletData.bonusBalance || 0) / (deedraPrice || 0.5)) * 100) / 100;
}

// ===== DEEDRA 시세 로드 =====
async function loadDeedraPrice() {
  try {
    const { doc, getDoc, db } = window.FB;
    const snap = await getDoc(doc(db, 'settings', 'deedraPrice'));
    if (snap.exists()) {
      deedraPrice = snap.data().price || 0.50;
      const updatedAt = snap.data().updatedAt;
      updatePriceTicker(deedraPrice, updatedAt);
    } else {
      updatePriceTicker(0.50, null);
    }
  } catch (err) {
    updatePriceTicker(0.50, null);
  }
}

function updatePriceTicker(price, updatedAt) {
  const el = document.getElementById('deedraPrice');
  const subEl = document.getElementById('deedraUpdated');
  const changeEl = document.getElementById('deedraChange');

  if (el) el.textContent = '$' + price.toFixed(4);
  if (subEl) subEl.textContent = updatedAt ? '업데이트: ' + fmtDate(updatedAt) : '';
  if (changeEl) {
    changeEl.textContent = '1 DDRA = $' + price.toFixed(4);
  }

  // DDRA 가격 변경 시 관련 UI 업데이트
  if (walletData) {
    const dedraUsd = (walletData.dedraBalance || 0) * price;
    const el2 = document.getElementById('splitDedraUsd');
    if (el2) el2.textContent = '≈ $' + fmt(dedraUsd);
    const el3 = document.getElementById('moreWalletDedraUsd');
    if (el3) el3.textContent = '≈ $' + fmt(dedraUsd);
    // 수익잔액 DDRA 환산 업데이트
    const bonus = walletData.bonusBalance || 0;
    const el5 = document.getElementById('splitBonusDdra');
    if (el5) el5.textContent = '≈ ' + fmt(bonus / (price || 0.5)) + ' DDRA';
    const el6 = document.getElementById('moreWalletBonusDdra');
    if (el6) el6.textContent = '≈ ' + fmt(bonus / (price || 0.5)) + ' DDRA';
    // 게임 잔액 업데이트 (DDRA 단위)
    gameBalanceVal = Math.floor((bonus / (price || 0.5)) * 100) / 100;
    const el4 = document.getElementById('gameBalanceUsd');
    if (el4) el4.textContent = '≈ $' + fmt(bonus) + ' USDT';
    // 출금 모달 DDRA 환산 업데이트
    updateWithdrawDdraCalc && updateWithdrawDdraCalc();
  }
}

// ===== 홈 EARN 패널 - 상품 미리보기 로드 =====
async function loadHomeEarn() {
  const listEl = document.getElementById('homeEarnList');
  if (!listEl) return;
  // 이미 캐시된 상품이 있으면 바로 렌더
  if (productsCache && productsCache.length > 0) {
    renderHomeEarn(productsCache);
    return;
  }
  try {
    const { collection, getDocs, db } = window.FB;
    const snap = await getDocs(collection(db, 'products'));
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('[EARN] 전체 상품 수:', allDocs.length, allDocs.map(p => ({name:p.name, isActive:p.isActive, type:p.type})));
    // type=investment 이거나 type 없는 것만, isActive 체크 없이 전체 표시
    const products = allDocs
      .filter(p => !p.type || p.type === 'investment')
      .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));
    console.log('[EARN] 필터 후 상품 수:', products.length);
    productsCache = products;
    renderHomeEarn(products);
  } catch (e) {
    console.error('[EARN] 상품 로드 오류:', e);
    listEl.innerHTML = '<div style="font-size:11px;color:rgba(255,255,255,0.35);text-align:center;padding:12px 0;">상품 없음</div>';
  }
}

function renderHomeEarn(products) {
  const listEl = document.getElementById('homeEarnList');
  if (!listEl) return;
  if (!products || !products.length) {
    listEl.innerHTML = '<div style="font-size:11px;color:rgba(255,255,255,0.35);text-align:center;padding:12px 0;">상품 없음</div>';
    return;
  }
  // 최대 3개만 표시
  const show = products.slice(0, 3);
  listEl.innerHTML = show.map(p => {
    // 필드명 호환: dailyRoi(% 단위 그대로) or roiPercent(%)
    const roi = p.roiPercent != null ? p.roiPercent
              : p.dailyRoi  != null  ? p.dailyRoi
              : 0;
    const days = p.durationDays != null ? p.durationDays
               : p.duration    != null  ? p.duration
               : '-';
    return `
    <div class="earn-item" onclick="switchPage('invest')">
      <div>
        <div class="earn-item-name">${p.name || '-'}</div>
        <div class="earn-item-period">${days}일 · 최소 $${fmt(p.minAmount || 0)}</div>
      </div>
      <div>
        <div class="earn-item-roi">${roi.toFixed(1)}%</div>
        <div class="earn-item-roi-label">일 수익률</div>
      </div>
    </div>`;
  }).join('');
}

// ===== 테마 =====
function restoreTheme() {
  const saved = localStorage.getItem('deedra_theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  currentTheme = theme;
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) { icon.className = 'fas fa-sun'; }
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.className = 'menu-item-toggle';
  } else {
    document.documentElement.removeAttribute('data-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) { icon.className = 'fas fa-moon'; }
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.className = 'menu-item-toggle on';
  }
  localStorage.setItem('deedra_theme', theme);
}

window.toggleTheme = function() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
};

window.toggleThemeFromMenu = function() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
};

window.toggleNoti = function(btn) {
  btn.classList.toggle('on');
};

window.changeLang = function(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  applyLang();
  const langNames = { ko: '한국어', en: 'English', vi: 'Tiếng Việt', th: 'ภาษาไทย' };
  showToast(`${langNames[lang]} 언어로 변경되었습니다`, 'success');
};

// ===== 화면 전환 =====
function showScreen(name) {
  document.getElementById('loadingScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.add('hidden');

  if (name === 'loading') document.getElementById('loadingScreen').classList.remove('hidden');
  else if (name === 'auth') document.getElementById('authScreen').classList.remove('hidden');
  else if (name === 'main') document.getElementById('mainApp').classList.remove('hidden');
}

// ===== 탭 전환 =====
window.switchPage = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(page + 'Page');
  const navEl = document.getElementById('nav-' + page);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  if (page === 'invest') loadInvestPage();
  else if (page === 'network') loadNetworkPage();
  else if (page === 'play') updateGameUI();
  else if (page === 'more') loadMorePage();
};

// ===== 인증 탭 =====
window.switchAuthTab = function(tab) {
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
};

// ===== 로그인 =====
window.handleLogin = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPassword').value;
  if (!email || !pw) { showToast('이메일과 비밀번호를 입력하세요.', 'warning'); return; }

  showScreen('loading');
  try {
    const { signInWithEmailAndPassword, auth } = window.FB;
    console.log('[Login] 시도:', email);
    const result = await signInWithEmailAndPassword(auth, email, pw);
    console.log('[Login] 성공:', result?.user?.email);
    // 세션 저장 (페이지 새로고침 시 복원용)
    if (result?.user) {
      localStorage.setItem('deedra_session', JSON.stringify({
        uid: result.user.uid,
        email: result.user.email
      }));
    }
    // 성공 시 loginWithEmail 내부에서 onAuthReady 직접 호출됨
  } catch (err) {
    console.error('[Login Error] code:', err.code, '| message:', err.message);
    showScreen('auth');
    showToast(getAuthErrorMsg(err.code), 'error');
  }
};

// ===== 회원가입 =====
window.handleRegister = async function() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pw = document.getElementById('regPassword').value;
  const refCode = document.getElementById('regReferral').value.trim();

  if (!name || !email || !pw || !refCode) { showToast('모든 필드를 입력해주세요.', 'warning'); return; }
  if (pw.length < 8) { showToast('비밀번호는 8자 이상이어야 합니다.', 'warning'); return; }

  const referrer = await findUserByReferralCode(refCode);
  if (!referrer) { showToast('유효하지 않은 추천인 코드입니다.', 'error'); return; }

  showScreen('loading');
  try {
    const { createUserWithEmailAndPassword, auth, doc, setDoc, db, serverTimestamp } = window.FB;
    const { user } = await createUserWithEmailAndPassword(auth, email, pw);
    const myCode = generateReferralCode(user.uid);

    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid, email, name, role: 'member', rank: 'G0', status: 'active',
      referralCode: myCode, referredBy: referrer.uid, referredByCode: refCode,
      createdAt: serverTimestamp(), phone: '', withdrawPin: null,
    });
    await setDoc(doc(db, 'wallets', user.uid), {
      userId: user.uid, usdtBalance: 0, dedraBalance: 0, bonusBalance: 0,
      totalDeposit: 0, totalWithdrawal: 0, totalEarnings: 0, createdAt: serverTimestamp(),
    });
    // 회원가입 후 자동 로그인 (세션 저장 + 앱 진입)
    localStorage.setItem('deedra_session', JSON.stringify({ uid: user.uid, email }));
    window.FB._currentUser = user;
    showToast('회원가입 완료! 환영합니다 🎉', 'success');
    await window.onAuthReady(user);
  } catch (err) {
    showScreen('auth');
    showToast(getAuthErrorMsg(err.code), 'error');
  }
};

// ===== 비밀번호 찾기 =====
window.handleForgotPassword = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showToast('이메일을 먼저 입력하세요.', 'warning'); return; }
  try {
    const { sendPasswordResetEmail, auth } = window.FB;
    await sendPasswordResetEmail(auth, email);
    showToast('비밀번호 재설정 이메일을 발송했습니다.', 'success');
  } catch (err) {
    showToast(getAuthErrorMsg(err.code), 'error');
  }
};

// ===== 로그아웃 =====
window.handleLogout = async function() {
  if (!confirm(t('logoutConfirm'))) return;
  const { signOut, auth } = window.FB;
  await signOut(auth);
  localStorage.removeItem('deedra_session');
  currentUser = null; userData = null; walletData = null;
  showScreen('auth');
};

// ===== 지갑 UI 빠른 갱신 (출금/투자 후 즉시 반영) =====
function updateWalletUI() {
  updateHomeUI();
  // more 페이지가 열려있으면 해당 잔액도 갱신
  if (currentPage === 'more' && walletData) {
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const bonus = walletData.bonusBalance || 0;
    const bonusDdra = bonus / (deedraPrice || 0.5);
    setEl('moreWalletUsdt', fmt(walletData.usdtBalance || 0) + ' USDT');
    // 수익잔액(bonusBalance)을 DDRA로 표시
    setEl('moreWalletBonus', fmt(bonusDdra) + ' DDRA');
    setEl('moreWalletBonusDdra', '≈ $' + fmt(bonus) + ' USDT');
    // dedraBalance(게임전용)는 내부적으로만 유지
    setEl('moreWalletDedra', fmt(walletData.dedraBalance || 0) + ' DDRA');
    const dedraUsd = (walletData.dedraBalance || 0) * deedraPrice;
    setEl('moreWalletDedraUsd', '≈ $' + fmt(dedraUsd));
  }
}

// ===== 홈 UI 업데이트 =====
function updateHomeUI() {
  if (!userData || !walletData) return;

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '새벽에도 열심히네요 🌙' : hour < 12 ? '좋은 아침이에요 ☀️' : hour < 18 ? '안녕하세요 👋' : '좋은 저녁이에요 🌆';

  const greetEl = document.getElementById('greetingMsg');
  const nameEl = document.getElementById('userNameDisplay');
  const rankEl = document.getElementById('userRankBadge');

  if (greetEl) greetEl.textContent = greeting;
  if (nameEl) nameEl.textContent = userData.name || '-';
  if (rankEl) rankEl.textContent = userData.rank || 'G0';

  const usdt = walletData.usdtBalance || 0;
  const dedra = walletData.dedraBalance || 0;
  const bonus = walletData.bonusBalance || 0;  // 수익 잔액 (USDT 기준, 출금 가능)
  // 총 자산 = USDT 원금 + 수익 잔액 (DDRA 게임 잔액 제외)
  const total = usdt + bonus;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setEl('totalAsset', fmt(total) + ' USDT');
  setEl('totalAssetKrw', '≈ ₩' + fmtInt(total * USD_KRW));
  setEl('splitUsdt', fmt(usdt) + ' USDT');
  // splitBonus: DDRA 단위로 표시 (이것이 출금 가능한 수량)
  const bonusDdra = bonus / (deedraPrice || 0.5);
  setEl('splitBonus', fmt(bonusDdra) + ' DDRA');
  setEl('splitBonusDdra', '≈ $' + fmt(bonus) + ' USDT');
  // splitDedra는 더 이상 별도 UI 없음 (통합됨)
}

// ===== D-Day 카드 =====
async function loadDDayCard() {
  try {
    const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active'),
      orderBy('startDate', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const inv = snap.docs[0].data();
    const card = document.getElementById('ddayCard');
    if (!card) return;
    card.classList.remove('hidden');

    const startTs = inv.startDate?.toDate ? inv.startDate.toDate() : new Date(inv.startDate);
    const endTs = inv.endDate?.toDate ? inv.endDate.toDate() : new Date(inv.endDate);
    const now = new Date();

    const totalMs = endTs - startTs;
    const elapsedMs = now - startTs;
    const remainMs = endTs - now;

    const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    const remainDays = Math.max(0, Math.ceil(remainMs / (1000 * 60 * 60 * 24)));

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setEl('ddayBadge', 'D-' + remainDays);
    setEl('ddayName', inv.productName || '투자 진행 중');
    setEl('ddayStart', fmtDateShort(startTs));
    setEl('ddayEnd', fmtDateShort(endTs));
    setEl('ddayAmount', fmt(inv.amount) + ' USDT');
    setEl('ddayReturn', '+' + fmt(inv.expectedReturn || 0) + ' USDT/일');
    setEl('ddayRemain', remainDays + '일 남음');

    const fill = document.getElementById('ddayFill');
    if (fill) fill.style.width = progress.toFixed(1) + '%';

  } catch (err) {
    // 조용히 실패
  }
}

// ===== 공지사항 =====
async function loadAnnouncements() {
  const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true),
      orderBy('isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAnnouncements(items, 'announcementList');
    renderAnnouncements(items, 'moreAnnouncementList');
  } catch (err) {
    const el = document.getElementById('announcementList');
    if (el) el.innerHTML = '<div class="empty-state">공지사항이 없습니다</div>';
  }
}

function renderAnnouncements(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i>공지사항이 없습니다</div>';
    return;
  }
  el.innerHTML = items.map(a => `
    <div class="announcement-item" onclick="showAnnouncementDetail('${a.id}')">
      <div class="ann-title">
        ${a.isPinned ? '<span class="pin-badge">공지</span>' : ''}${a.title || '제목 없음'}
      </div>
      <div class="ann-date">${fmtDate(a.createdAt)}</div>
    </div>
  `).join('');
}

window.showAnnouncementModal = async function() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true),
      orderBy('isPinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAnnouncements(items, 'announcementFullList');
  } catch {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
};

window.showAnnouncementDetail = async function(id) {
  const { doc, getDoc, db } = window.FB;
  // 공지사항 상세 모달 표시
  const modal = document.getElementById('announcementDetailModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const titleEl = document.getElementById('annDetailTitle');
  const dateEl  = document.getElementById('annDetailDate');
  const bodyEl  = document.getElementById('annDetailBody');
  if (titleEl) titleEl.textContent = '불러오는 중...';
  if (bodyEl)  bodyEl.innerHTML   = '<div class="skeleton-item"></div>';
  try {
    const snap = await getDoc(doc(db, 'announcements', id));
    if (!snap.exists()) { if (bodyEl) bodyEl.innerHTML = '<div class="empty-state">공지사항을 찾을 수 없습니다.</div>'; return; }
    const a = snap.data();
    if (titleEl) titleEl.textContent = (a.isPinned ? '📌 ' : '📢 ') + (a.title || '제목 없음');
    if (dateEl)  dateEl.textContent  = fmtDate(a.createdAt);
    if (bodyEl)  bodyEl.innerHTML    = `<div class="ann-detail-content">${(a.content || '내용 없음').replace(/\n/g, '<br>')}</div>`;
  } catch(e) {
    if (bodyEl) bodyEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
};

// ===== 최근 거래 =====
async function loadRecentTransactions() {
  const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
  try {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const snap = await getDocs(q);
    renderTxList(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'recentTxList');
  } catch (err) {
    const el = document.getElementById('recentTxList');
    if (el) el.innerHTML = '<div class="empty-state">거래 내역이 없습니다</div>';
  }
}

function renderTxList(txs, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i>거래 내역이 없습니다</div>';
    return;
  }
  const icons = { deposit: '⬇️', withdrawal: '⬆️', bonus: '🎁', invest: '📈', game: '🎮' };
  const statusTxt = { pending: '승인 대기', approved: '완료', rejected: '거부됨' };

  el.innerHTML = txs.map(tx => {
    const isPlus = ['deposit', 'bonus'].includes(tx.type);
    return `
    <div class="tx-item">
      <div class="tx-icon ${tx.type}">${icons[tx.type] || '💱'}</div>
      <div class="tx-info">
        <div class="tx-title">${getTxTypeName(tx.type)}</div>
        <div class="tx-date">${fmtDate(tx.createdAt)}</div>
      </div>
      <div>
        <div class="tx-amount ${isPlus ? 'plus' : 'minus'}">
          ${isPlus ? '+' : '-'}${fmt(tx.amount)} ${tx.currency || 'USDT'}
        </div>
        <div class="tx-status">${statusTxt[tx.status] || tx.status}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== More 페이지 =====
function loadMorePage() {
  if (!userData || !walletData) return;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setEl('profileName', userData.name || '-');
  setEl('profileEmail', userData.email || '-');
  const rankEl = document.getElementById('profileRank');
  if (rankEl) rankEl.innerHTML = `<i class="fas fa-star" style="font-size:10px"></i> ${userData.rank || 'G0'}`;

  const dedra = walletData.dedraBalance || 0;
  const bonus = walletData.bonusBalance || 0;
  const dedraUsd = dedra * deedraPrice;
  const bonusDdra = bonus / (deedraPrice || 0.5);
  setEl('moreWalletUsdt', fmt(walletData.usdtBalance || 0) + ' USDT');
  setEl('moreWalletBonus', fmt(bonus) + ' USDT');  // 수익잔액
  setEl('moreWalletBonusDdra', '≈ ' + fmt(bonusDdra) + ' DDRA');
  setEl('moreWalletDedra', fmt(dedra) + ' DDRA');
  setEl('moreWalletDedraUsd', '≈ $' + fmt(dedraUsd));

  // 다크모드 토글 동기화
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.className = currentTheme === 'dark' ? 'menu-item-toggle on' : 'menu-item-toggle';

  loadTxHistory('all');
}

async function loadTxHistory(typeFilter) {
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const listEl = document.getElementById('txHistoryList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    // ROI 탭: bonuses 컬렉션
    if (typeFilter === 'roi') {
      const q = query(
        collection(db, 'bonuses'),
        where('userId', '==', currentUser.uid),
        limit(40)
      );
      const snap = await getDocs(q);
      const bonuses = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.seconds || a.createdAt?.toMillis?.() / 1000 || 0;
          const tb = b.createdAt?.seconds || b.createdAt?.toMillis?.() / 1000 || 0;
          return tb - ta;
        });
      renderBonusList(bonuses, 'txHistoryList');
      return;
    }

    // 일반 거래내역 - 복합 인덱스 없이 단일 필터로 조회 후 JS 정렬
    let q;
    if (typeFilter === 'all') {
      q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), limit(50));
    } else {
      q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', typeFilter), limit(50));
    }
    const snap = await getDocs(q);
    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.seconds || a.createdAt?.toMillis?.() / 1000 || 0;
        const tb = b.createdAt?.seconds || b.createdAt?.toMillis?.() / 1000 || 0;
        return tb - ta;
      })
      .slice(0, 30);
    renderTxList(txs, 'txHistoryList');
  } catch (err) {
    console.error('loadTxHistory error:', err);
    if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><br>거래 내역이 없습니다</div>';
  }
}

/**
 * bonuses 컬렉션 내역 렌더링
 * type: roi_income (본인 ROI), direct_bonus, unilevel_bonus
 */
function renderBonusList(bonuses, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!bonuses.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-coins"></i>수익 내역이 없습니다<br><span style="font-size:12px;color:var(--text2);">관리자가 일일 정산을 실행하면 여기에 표시됩니다.</span></div>';
    return;
  }

  const typeLabel = {
    roi_income:    '📈 투자 ROI 수익',
    direct_bonus:  '👥 직접 추천 보너스',
    unilevel_bonus:'🌐 유니레벨 보너스',
    rank_bonus:    '🏆 직급 보너스',
  };

  el.innerHTML = bonuses.map(b => {
    const label = typeLabel[b.type] || b.type || '보너스';
    const dateStr = fmtDate(b.createdAt);
    const details = b.settlementDate ? `정산일: ${b.settlementDate}` : (b.reason || '');
    const level   = b.level ? ` · ${b.level}단계` : '';
    const base    = b.baseIncome ? ` · 기준 D: $${fmt(b.baseIncome)}` : (b.investAmount ? ` · 투자 $${fmt(b.investAmount)}` : '');

    return `
    <div class="tx-item">
      <div class="tx-icon bonus">💰</div>
      <div class="tx-info">
        <div class="tx-title">${label}${level}</div>
        <div class="tx-date">${dateStr}${base}</div>
        <div class="tx-date" style="font-size:10px;color:var(--text2);">${details}</div>
      </div>
      <div>
        <div class="tx-amount plus">+${fmt(b.amount)} USDT</div>
        <div class="tx-status" style="color:var(--green)">완료</div>
      </div>
    </div>`;
  }).join('');
}

window.switchTxTab = function(type, el) {
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadTxHistory(type);
};

// ===== 입금 신청 =====
window.showDepositModal = function() {
  loadCompanyWallet();
  document.getElementById('depositModal').classList.remove('hidden');
};

async function loadCompanyWallet() {
  try {
    const { doc, getDoc, db } = window.FB;
    const snap = await getDoc(doc(db, 'settings', 'wallets'));
    const addr = document.getElementById('companyWalletAddr');
    if (snap.exists() && addr) addr.textContent = snap.data().trc20 || '주소 미설정 (관리자 문의)';
  } catch {
    const addr = document.getElementById('companyWalletAddr');
    if (addr) addr.textContent = '주소 로드 실패';
  }
}

window.copyWalletAddress = function() {
  const addr = document.getElementById('companyWalletAddr');
  if (addr) navigator.clipboard.writeText(addr.textContent).then(() => showToast('주소가 복사되었습니다!', 'success'));
};

window.submitDeposit = async function() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  const txid = document.getElementById('depositTxid').value.trim();
  const memo = document.getElementById('depositMemo').value.trim();

  if (!amount || amount <= 0) { showToast('입금 금액을 입력하세요.', 'warning'); return; }
  if (!txid) { showToast('TXID를 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'transactions'), {
      userId: currentUser.uid, userEmail: currentUser.email,
      type: 'deposit', amount, currency: 'USDT', txid, memo,
      status: 'pending', createdAt: serverTimestamp(),
    });
    closeModal('depositModal');
    showToast('입금 신청 완료! 관리자 승인을 기다려주세요.', 'success');
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositTxid').value = '';
  } catch (err) {
    showToast(t('failPrefix') + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = t('btnSubmitDeposit');
  }
};

// ===== 출금 신청 =====
window.showWithdrawModal = function() {
  const bonus = walletData?.bonusBalance || 0;
  const bonusDdra = bonus / (deedraPrice || 0.5);  // DDRA 환산
  // 출금 가능 DDRA 표시
  const avEl = document.getElementById('withdrawAvailable');
  if (avEl) avEl.textContent = fmt(bonusDdra);
  // USDT 환산 부제목
  const avUsdtEl = document.getElementById('withdrawAvailableUsdt');
  if (avUsdtEl) avUsdtEl.textContent = '≈ $' + fmt(bonus) + ' USDT';
  updateWithdrawDdraCalc();
  document.getElementById('withdrawModal').classList.remove('hidden');
};

// 출금 모달에서 DDRA 수량 입력 시 USDT 환산 실시간 업데이트
window.onWithdrawAmountInput = function() {
  updateWithdrawDdraCalc();
};

function updateWithdrawDdraCalc() {
  const amtEl = document.getElementById('withdrawAmount');
  const calcEl = document.getElementById('withdrawDdraCalc');
  if (!calcEl) return;
  const ddrAmt = parseFloat(amtEl?.value || '0') || 0;
  const price = deedraPrice || 0.5;
  if (ddrAmt > 0 && price > 0) {
    const usdtAmt = ddrAmt * price;
    calcEl.textContent = `≈ $${fmt(usdtAmt)} USDT (1 DDRA = $${price.toFixed(4)} USDT)`;
    calcEl.style.color = '#f59e0b';
  } else {
    calcEl.textContent = `1 DDRA = $${price.toFixed(4)} USDT`;
    calcEl.style.color = '#94a3b8';
  }
}

window.submitWithdraw = async function() {
  // 입력값: DDRA 수량
  const ddrAmt = parseFloat(document.getElementById('withdrawAmount').value);
  const address = document.getElementById('withdrawAddress').value.trim();
  const pin = document.getElementById('withdrawPin').value;

  if (!ddrAmt || ddrAmt <= 0) { showToast(t('toastEnterWithAmt'), 'warning'); return; }
  if (!address) { showToast(t('toastEnterWithAddr'), 'warning'); return; }
  if (!pin || pin.length !== 6) { showToast(t('toastEnterPin'), 'warning'); return; }
  if (!/^\d{6}$/.test(pin)) { showToast('PIN은 숫자 6자리여야 합니다.', 'warning'); return; }

  // PIN 미설정 시 설정 유도
  if (!userData?.withdrawPin) {
    showToast('출금 PIN이 설정되지 않았습니다. 먼저 PIN을 설정해주세요.', 'warning');
    closeModal('withdrawModal');
    setTimeout(() => showWithdrawPinSetup(), 300);
    return;
  }

  const price = deedraPrice || 0.5;
  const amountUsdt = ddrAmt * price;  // USDT 환산

  // 출금 가능 금액 = bonusBalance(USDT) → DDRA 환산 기준
  const availableBonus = walletData?.bonusBalance || 0;
  const availableDdra = availableBonus / price;
  if (availableDdra < ddrAmt) {
    showToast(`출금 가능 DDRA 부족 (가능: ${fmt(availableDdra)} DDRA)`, 'error'); return;
  }
  if (userData?.withdrawPin && userData.withdrawPin !== btoa(pin)) { showToast(t('toastWrongPin'), 'error'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp, doc, getDoc, updateDoc, increment, writeBatch } = window.FB;

    // ── VIP 할인율 적용 수수료 계산 ──────────────────────────────────
    let feeRate = 0;
    let feeAmount = 0;
    try {
      const ratesSnap = await getDoc(doc(db, 'settings', 'rates'));
      if (ratesSnap.exists()) {
        const rates = ratesSnap.data();
        const baseWithdrawFee = rates.withdrawFeeRate || 0;
        const vipDiscounts = rates.vipDiscounts || {};
        const vipLevel = userData?.vipLevel || 'bronze';
        const discount = vipDiscounts[vipLevel] || 0;
        feeRate = Math.max(0, baseWithdrawFee - discount);
        feeAmount = ddrAmt * feeRate / 100;  // 수수료 DDRA
      }
    } catch(e) { console.warn('[VIP Fee] 수수료 계산 실패, 기본 0% 적용:', e); }

    const netDdra = ddrAmt - feeAmount;        // 수수료 제외 실 지급 DDRA
    const netUsdt = netDdra * price;            // USDT 환산

    // ── 원자적 처리: 출금 신청 생성 + bonusBalance 차감 ─────────────
    const batch = writeBatch(db);

    const txRef = doc(collection(db, 'transactions'));
    batch.set(txRef, {
      userId: currentUser.uid, userEmail: currentUser.email,
      type: 'withdrawal',
      amountDdra: ddrAmt,          // 신청 DDRA 수량
      amountUsdt: amountUsdt,      // USDT 환산
      amount: netDdra,             // 실 지급 DDRA (수수료 제외)
      currency: 'DDRA',
      ddraPrice: price,            // 적용 시세
      walletAddress: address,
      feeRate, feeAmount, netUsdt,
      status: 'pending', createdAt: serverTimestamp(),
    });

    // bonusBalance 차감 (USDT 기준으로 차감)
    const walletRef = doc(db, 'wallets', currentUser.uid);
    batch.update(walletRef, {
      bonusBalance: increment(-amountUsdt),
      totalWithdrawal: increment(amountUsdt),
    });

    await batch.commit();

    // 로컬 walletData 즉시 반영
    if (walletData) {
      walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) - amountUsdt);
      walletData.totalWithdrawal = (walletData.totalWithdrawal || 0) + amountUsdt;
    }

    closeModal('withdrawModal');
    const feeMsg = feeAmount > 0 ? ` (수수료 ${fmt(feeAmount)} DDRA)` : '';
    showToast(`출금 신청 완료! ${fmt(netDdra)} DDRA${feeMsg} 지급 예정`, 'success');
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawAddress').value = '';
    document.getElementById('withdrawPin').value = '';
    // 지갑 UI 갱신
    updateWalletUI();
    loadTransactions();
  } catch (err) {
    showToast(t('failPrefix') + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = t('btnSubmitWithdraw');
  }
};

// ===== 투자 페이지 =====
async function loadInvestPage() {
  loadProducts();
  loadMyInvestments();
  loadSimulatorOptions();
}

async function loadProducts() {
  const { collection, getDocs, db } = window.FB;
  const listEl = document.getElementById('productList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item tall"></div><div class="skeleton-item tall"></div>';
  try {
    const snap = await getDocs(collection(db, 'products'));
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('[Products] 전체 상품:', allDocs.length, allDocs.map(p=>({name:p.name,isActive:p.isActive,type:p.type})));
    productsCache = allDocs
      .filter(p => !p.type || p.type === 'investment')
      .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));

    if (!productsCache.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-snowflake"></i>FREEZE 플랜이 없습니다</div>';
      return;
    }

    const tierMap = { 'Basic': 'basic', 'Standard': 'standard', 'Premium': 'premium', 'VIP': 'vip' };
    const tagMap = { 'Basic': 'tag-basic', 'Standard': 'tag-standard', 'Premium': 'tag-premium', 'VIP': 'tag-vip' };

    if (listEl) listEl.innerHTML = productsCache.map(p => {
      // 필드명 호환: dailyRoi(% 단위 그대로) or roiPercent(%)
      const roi = p.roiPercent != null ? p.roiPercent
                : p.dailyRoi  != null  ? p.dailyRoi
                : 0;
      const days = p.durationDays != null ? p.durationDays
                 : p.duration    != null  ? p.duration
                 : 0;
      const tierName = p.name || '';
      const tierMap2 = ['1개월','Basic'];
      const tier = tierMap[tierName] || (tierName.includes('1개월') ? 'basic' : tierName.includes('3개월') ? 'standard' : tierName.includes('6개월') ? 'premium' : tierName.includes('12개월') ? 'vip' : 'basic');
      const tag  = tagMap[tierName]  || ('tag-' + tier);
      const dailyEarning = (p.minAmount || 0) * roi / 100;
      return `
      <div class="product-card">
        <div class="product-tier-bar tier-${tier}"></div>
        <div class="product-top">
          <div>
            <div class="product-name">${p.name || '-'}</div>
            <span class="product-tag ${tag}">${p.name || '-'}</span>
          </div>
          <div class="product-roi-block">
            <div class="product-roi">${roi.toFixed(1)}%</div>
            <div class="product-roi-label">일 수익률</div>
          </div>
        </div>
        <div class="product-meta">
          <div class="product-meta-item">기간: <strong>${days}일</strong></div>
          <div class="product-meta-item">최소: <strong>${fmt(p.minAmount)} USDT</strong></div>
          <div class="product-meta-item">최대: <strong>${fmt(p.maxAmount)} USDT</strong></div>
        </div>
        <div class="product-conversion">
          ❄️ ${fmt(p.minAmount)} USDT FREEZE 시 일 수익 <strong>~${fmt(dailyEarning)} USDT</strong>
          (≈ ${fmt(dailyEarning / (deedraPrice||0.5))} DDRA/일) · 🔒 만기 후 언프리즈 가능
        </div>
        <button class="invest-btn" onclick="openInvestModal('${p.id}','${p.name || ''}',${roi},${days},${p.minAmount||0},${p.maxAmount||9999})">
          ❄️ FREEZE
        </button>
      </div>`;
    }).join('');
  } catch (err) {
    console.warn(err);
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

function loadSimulatorOptions() {
  const sel = document.getElementById('simProduct');
  if (!sel || !productsCache.length) return;
  sel.innerHTML = '<option value="">상품 선택</option>';
  productsCache.forEach(p => {
    const roi  = p.roiPercent != null ? p.roiPercent : (p.dailyRoi != null ? p.dailyRoi : 0);
    const days = p.durationDays != null ? p.durationDays : (p.duration != null ? p.duration : 0);
    sel.innerHTML += `<option value="${p.id}" data-roi="${roi}" data-days="${days}" data-min="${p.minAmount||0}" data-max="${p.maxAmount||9999}">${p.name} (${roi}% / ${days}일)</option>`;
  });
}

window.runSimulator = function() {
  const sel = document.getElementById('simProduct');
  const amtEl = document.getElementById('simAmount');
  const result = document.getElementById('simResult');
  if (!sel || !amtEl || !result) return;

  const opt = sel.options[sel.selectedIndex];
  const amount = parseFloat(amtEl.value);
  if (!opt.dataset.roi || !amount || isNaN(amount)) {
    result.classList.remove('show'); return;
  }

  const roi = parseFloat(opt.dataset.roi);
  const days = parseInt(opt.dataset.days);
  const earning = (amount * roi / 100);           // 하루 USDT 수익
  const totalEarning = earning * days;            // 전체 기간 USDT 수익
  const earningDdra = earning / (deedraPrice||0.5); // 하루 DDRA 환산

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('simInputAmount', fmt(amount) + ' USDT');
  setEl('simDays', days + '일');
  setEl('simRoi', roi + '%');
  setEl('simEarning', fmt(earning) + ' USDT/일 (' + fmt(earningDdra) + ' DDRA)');
  setEl('simEarningUsd', fmt(totalEarning) + ' USDT (' + days + '일 합계)');

  result.classList.add('show');
};

// ===== 투자 만기 자동 처리 =====
async function autoCompleteExpiredInvestments(investDocs) {
  if (!currentUser || !investDocs || investDocs.length === 0) return;
  const now = new Date();
  const { doc, updateDoc, addDoc, collection, db, serverTimestamp, increment, writeBatch } = window.FB;
  const expired = investDocs.filter(d => {
    const inv = d.data();
    if (inv.status !== 'active') return false;
    const endDate = inv.endDate?.toDate ? inv.endDate.toDate() : (inv.endDate ? new Date(inv.endDate) : null);
    return endDate && now >= endDate;
  });
  if (expired.length === 0) return;

  for (const d of expired) {
    const inv = d.data();
    try {
      const batch = writeBatch(db);
      // 투자 상태를 completed로 변경
      batch.update(doc(db, 'investments', d.id), {
        status: 'completed',
        completedAt: serverTimestamp()
      });
      // 원금(USDT)을 wallets.usdtBalance에 반환
      batch.update(doc(db, 'wallets', currentUser.uid), {
        usdtBalance: increment(inv.amount || 0)
      });
      await batch.commit();

      // 만기 알림 생성
      await addDoc(collection(db, 'notifications'), {
        userId: currentUser.uid,
        type: 'invest',
        title: '✅ 투자 만기 완료',
        message: `[${inv.productName}] 투자 계약이 만료되었습니다. 원금 ${fmt(inv.amount)} USDT가 지갑에 반환되었습니다.`,
        isRead: false,
        createdAt: serverTimestamp()
      });

      // 로컬 walletData 즉시 반영
      if (walletData) {
        walletData.usdtBalance = (walletData.usdtBalance || 0) + (inv.amount || 0);
      }
      console.info(`[AutoComplete] 투자 만기 처리 완료: ${d.id} (${inv.productName}, ${inv.amount} USDT 반환)`);
    } catch(e) { console.warn('[AutoComplete] 만기 처리 실패:', d.id, e); }
  }
  if (expired.length > 0) {
    // 만기 처리 후 지갑 UI 갱신
    updateWalletUI();
    updateHomeUI();
    showToast(`📋 만기 투자 ${expired.length}건의 원금이 반환되었습니다.`, 'success');
  }
}

async function loadMyInvestments() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const listEl = document.getElementById('myInvestList');
  const sumItems = { count: 0, total: 0, returns: 0 };
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';

  try {
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active'),
      orderBy('startDate', 'desc')
    );
    const snap = await getDocs(q);
    const invests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 만기 투자 자동 처리
    await autoCompleteExpiredInvestments(snap.docs);

    invests.forEach(inv => {
      sumItems.count++;
      sumItems.total += inv.amount || 0;
      sumItems.returns += inv.expectedReturn || 0;
    });

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('activeInvestCount', sumItems.count + '건');
    setEl('totalInvestAmount', '$' + fmt(sumItems.total));
    setEl('expectedReturn', fmt(sumItems.returns) + ' USDT/일');

    if (!invests.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-chart-line"></i>진행 중인 투자가 없습니다</div>';
      return;
    }

    if (listEl) listEl.innerHTML = invests.map(inv => {
      const start = inv.startDate?.toDate ? inv.startDate.toDate() : new Date();
      const end = inv.endDate?.toDate ? inv.endDate.toDate() : new Date();
      const now = new Date();
      const progress = Math.min(100, ((now - start) / (end - start)) * 100);
      const remainDays = Math.max(0, Math.ceil((end - now) / 86400000));

      // 일일 ROI 수익 D = 투자금 × roiPercent%
      // roiPercent: % 단위, dailyRoi: % 단위 (0.4 = 0.4%)
      const dailyRoiRate = (inv.roiPercent != null ? inv.roiPercent : inv.dailyRoi || 0) / 100;
      const dailyD = inv.amount * dailyRoiRate;

      return `
      <div class="invest-item">
        <div class="invest-item-header">
          <span class="invest-item-name">${inv.productName || '투자'}</span>
          <span class="invest-item-amount">$${fmt(inv.amount)}</span>
        </div>
        <div class="invest-item-detail" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
          <span>❄️ 일 수익: <strong style="color:var(--green)">+$${fmt(dailyD)}</strong> (${(dailyRoiRate*100).toFixed(2)}%/일)</span>
          <span>잔여 ${remainDays}일</span>
        </div>
        <div class="invest-item-detail" style="color:var(--text2);font-size:11px;margin-top:2px;">
          총 예상수익(일): +${fmt(inv.expectedReturn || 0)} USDT (원금은 만기 후 출금 가능)
        </div>
        <div class="invest-progress">
          <div class="invest-progress-fill" style="width:${progress.toFixed(1)}%"></div>
        </div>
      </div>`;
    }).join('');

  } catch (err) {
    console.warn(err);
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

window.openInvestModal = function(id, name, roi, days, minAmt, maxAmt) {
  selectedProduct = { id, name, roi, days, minAmt, maxAmt };

  const sumEl = document.getElementById('investProductSummary');
  if (sumEl) sumEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:18px;font-weight:800;color:var(--text)">${name}</div>
      <div style="font-size:24px;font-weight:900;color:var(--green)">${roi}% <span style="font-size:13px;font-weight:600;">/ 일</span></div>
    </div>
    <div style="font-size:13px;color:var(--text2)">
      기간: <strong>${days}일</strong> · 최소 ${fmt(minAmt)} USDT ~ 최대 ${fmt(maxAmt)} USDT
    </div>`;

  const hintEl = document.getElementById('investAmountHint');
  if (hintEl) hintEl.textContent = `최소 ${fmt(minAmt)} USDT ~ 최대 ${fmt(maxAmt)} USDT`;

  const amtEl = document.getElementById('investAmount');
  if (amtEl) amtEl.value = '';
  const previewEl = document.getElementById('investPreview');
  if (previewEl) previewEl.style.display = 'none';

  document.getElementById('investModal').classList.remove('hidden');
};

window.updateInvestPreview = function() {
  if (!selectedProduct) return;
  const amount = parseFloat(document.getElementById('investAmount').value);
  const previewEl = document.getElementById('investPreview');
  if (!previewEl || !amount || isNaN(amount)) { if (previewEl) previewEl.style.display = 'none'; return; }

  const earning = (amount * selectedProduct.roi / 100); // USDT 일 수익
  const earningDdra = earning / (deedraPrice || 0.5);
  previewEl.style.display = 'block';
  previewEl.innerHTML = `
    📌 일 수익: <strong style="color:var(--green)">${fmt(earning)} USDT</strong><br>
    💡 DDRA 환산: ≈ ${fmt(earningDdra)} DDRA/일 (1 DDRA = $${(deedraPrice||0.5).toFixed(4)})<br>
    📅 만기일: ${getDaysLaterStr(selectedProduct.days)}<br>
    🔒 원금은 만기 후 언프리즈 가능합니다.`;
};

window.submitInvest = async function() {
  if (!selectedProduct) return;
  const amount = parseFloat(document.getElementById('investAmount').value);

  if (!amount || amount <= 0) { showToast('FREEZE 금액을 입력하세요.', 'warning'); return; }
  if (amount < selectedProduct.minAmt) { showToast(t('toastMinInvest') + selectedProduct.minAmt, 'warning'); return; }
  if (amount > selectedProduct.maxAmt) { showToast(t('toastMaxInvest') + selectedProduct.maxAmt, 'warning'); return; }
  if ((walletData?.usdtBalance || 0) < amount) { showToast('USDT 잔액이 부족합니다.', 'error'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp, doc, updateDoc, increment, writeBatch } = window.FB;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + selectedProduct.days * 86400000);
    const expectedReturn = (amount * selectedProduct.roi / 100); // USDT 일 수익

    // 원자적 처리: 투자 도큐먼트 생성 + 지갑 USDT 차감
    const batch = writeBatch(db);

    // 1) investments 컬렉션에 투자 도큐먼트 추가 (addDoc 대신 batch에서 setDoc 사용)
    const invRef = doc(collection(db, 'investments'));
    batch.set(invRef, {
      userId: currentUser.uid, productId: selectedProduct.id,
      productName: selectedProduct.name, amount,
      roiPercent: selectedProduct.roi, durationDays: selectedProduct.days,
      expectedReturn, status: 'active',
      startDate: serverTimestamp(), endDate,
      createdAt: serverTimestamp(),
    });

    // 2) 지갑 USDT 차감 + 총 투자액 증가
    const walletRef = doc(db, 'wallets', currentUser.uid);
    batch.update(walletRef, {
      usdtBalance: increment(-amount),
      totalInvest: increment(amount),
    });

    await batch.commit();

    // 로컬 walletData도 즉시 반영 (UI 즉시 업데이트)
    if (walletData) {
      walletData.usdtBalance = (walletData.usdtBalance || 0) - amount;
      walletData.totalInvest = (walletData.totalInvest || 0) + amount;
    }

    closeModal('investModal');
    showToast(t('toastInvestDone'), 'success');
    loadMyInvestments();
    // 지갑 UI 즉시 갱신
    updateWalletUI();
    loadTransactions();
  } catch (err) {
    showToast(t('failPrefix') + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = t('btnSubmitInvest');
  }
};

// ===== 네트워크 페이지 =====
async function loadNetworkPage() {
  if (!userData) return;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setEl('myReferralCode', userData.referralCode || '-');
  updateRankUI();
  loadReferralList();
  buildOrgTree();
}

function updateRankUI() {
  if (!userData) return;
  const rank    = userData.rank || 'G0';
  const rankIdx = RANKS.findIndex(r => r.rank === rank);
  const nextRankObj = RANKS[rankIdx + 1];

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setEl('rankCurrent', rank);

  // ── 새 승진 조건 (관리자 설정) 방식 ──────────────────────────
  if (rankPromoSettings && rankPromoSettings.criteria && nextRankObj) {
    const criteria   = rankPromoSettings.criteria;
    const nextRankId = nextRankObj.rank;
    const crit       = criteria[nextRankId];
    const depth      = rankPromoSettings.networkDepth || 3;
    const mode       = rankPromoSettings.promotionMode || 'all';

    if (crit) {
      // 현재 보유 값 (walletData/userData에서)
      const selfInvest     = walletData?.totalDeposit     || 0;
      const networkMembers = userData?.totalReferrals     || 0;

      // 조건 표시 우선순위: 인원 수 > 투자액 순으로 진행도 표시
      const hasInvestCond  = (crit.minSelfInvest     || 0) > 0;
      const hasSalesCond   = (crit.minNetworkSales   || 0) > 0;
      const hasMemberCond  = (crit.minNetworkMembers || 0) > 0;

      // 진행도: 가장 의미 있는 조건을 선택
      let progressPct  = 0;
      let progressDesc = '';
      let needed       = '';

      if (hasMemberCond) {
        const cur = networkMembers;
        const req = crit.minNetworkMembers;
        progressPct  = Math.min(100, (cur / req) * 100);
        needed       = req - cur > 0 ? `산하 ${req - cur}명 더 필요` : '인원 조건 달성!';
        progressDesc = `산하 ${cur}/${req}명 (${depth}대)`;
      } else if (hasInvestCond) {
        const cur = selfInvest;
        const req = crit.minSelfInvest;
        progressPct  = Math.min(100, (cur / req) * 100);
        needed       = req - cur > 0 ? `투자 $${(req - cur).toFixed(0)} 더 필요` : '투자 조건 달성!';
        progressDesc = `투자 $${cur.toFixed(0)}/$${req}`;
      } else {
        progressPct  = 100;
        progressDesc = '조건 미설정';
        needed       = '';
      }

      // 다음 직급 표시
      const modeLabel = mode === 'any' ? '[OR]' : '[AND]';
      const condParts = [];
      if (hasInvestCond)  condParts.push(`투자 $${crit.minSelfInvest}`);
      if (hasSalesCond)   condParts.push(`매출 $${crit.minNetworkSales}`);
      if (hasMemberCond)  condParts.push(`인원 ${crit.minNetworkMembers}명`);
      const condStr = condParts.length ? condParts.join(' / ') : '조건 없음';

      setEl('rankNextLabel', `${nextRankId} ${modeLabel} ${condStr}`);
      setEl('rankReferralCount', progressDesc);

      const fill = document.getElementById('rankProgressFill');
      if (fill) fill.style.width = progressPct.toFixed(1) + '%';

      // 추가 필요 조건 표시
      const needEl = document.getElementById('rankNeeded');
      if (needEl) needEl.textContent = needed;
      return;
    }
  }

  // ── 레거시 방식 (추천인 수 기반) ─────────────────────────────
  const refCount = userData.referralCount || userData.totalReferrals || 0;
  setEl('rankReferralCount', refCount);
  if (nextRankObj) {
    const progress = Math.min(100, (refCount / nextRankObj.minRefs) * 100);
    setEl('rankNextLabel', `${nextRankObj.rank} (${nextRankObj.minRefs - refCount}명 필요)`);
    const fill = document.getElementById('rankProgressFill');
    if (fill) fill.style.width = progress.toFixed(1) + '%';
  } else {
    setEl('rankNextLabel', '최고 직급 달성! 🏆');
    const fill = document.getElementById('rankProgressFill');
    if (fill) fill.style.width = '100%';
  }
}

async function loadReferralList() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const listEl = document.getElementById('referralList');
  const netBonus = document.getElementById('netBonus');
  const netDirect = document.getElementById('netDirectCount');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const refs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (netDirect) netDirect.textContent = refs.length;
    if (netBonus) netBonus.textContent = fmt(walletData?.totalEarnings || 0) + ' USDT';

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('rankReferralCount', refs.length);

    if (!refs.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-user-friends"></i>추천인이 없습니다</div>';
      return;
    }

    if (listEl) listEl.innerHTML = refs.map(r => `
      <div class="referral-item">
        <div class="ref-avatar"><i class="fas fa-user"></i></div>
        <div class="ref-info">
          <div class="ref-name">${r.name || '이름 없음'}</div>
          <div class="ref-date">${fmtDate(r.createdAt)}</div>
        </div>
        <div class="ref-rank">${r.rank || 'G0'}</div>
      </div>`).join('');

  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

async function buildOrgTree() {
  const treeEl = document.getElementById('orgTree');
  if (!treeEl) return;
  treeEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i>로딩 중...</div>';

  try {
    const { collection, query, where, getDocs, db } = window.FB;
    const q = query(collection(db, 'users'), where('referredBy', '==', currentUser.uid));
    const snap = await getDocs(q);
    const children = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!children.length) {
      treeEl.innerHTML = `
        <div style="text-align:center;padding:30px">
          <div class="org-node me" style="display:inline-block">
            <div class="org-node-name">${userData?.name || '나'}</div>
            <div class="org-node-rank">${userData?.rank || 'G0'}</div>
          </div>
          <div style="margin-top:16px;font-size:13px;color:var(--text3)">
            추천 링크를 공유하여 네트워크를 확장해보세요!
          </div>
        </div>`;
      return;
    }

    const meNode = `
      <div class="org-node-wrap">
        <div class="org-node root" onclick="showOrgTooltip(event, '${userData?.name}', '${userData?.rank}', '나', '')">
          <div class="org-node-name">${userData?.name || '나'}</div>
          <div class="org-node-rank">${userData?.rank || 'G0'}</div>
        </div>
        <div class="org-connector-v"></div>
      </div>`;

    const childNodes = children.map(c => `
      <div class="org-node-wrap">
        <div class="org-connector-v" style="height:12px"></div>
        <div class="org-node" onclick="showOrgTooltip(event, '${c.name}', '${c.rank}', '추천인', '${fmtDateShort(c.createdAt)}')">
          <div class="org-node-name">${c.name || '회원'}</div>
          <div class="org-node-rank">${c.rank || 'G0'}</div>
        </div>
      </div>`).join('');

    treeEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:0">
        ${meNode}
        <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
          ${childNodes}
        </div>
      </div>`;

    setupOrgPanZoom();

  } catch (err) {
    treeEl.innerHTML = '<div class="empty-state">조직도 로드 실패</div>';
  }
}

window.showOrgTooltip = function(event, name, rank, relation, date) {
  const tooltip = document.getElementById('orgTooltip');
  if (!tooltip) return;
  tooltip.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px">${name}</div>
    <div style="color:var(--accent);font-size:12px">${rank} · ${relation}</div>
    ${date ? `<div style="color:var(--text3);font-size:11px;margin-top:2px">가입: ${date}</div>` : ''}`;
  tooltip.style.left = Math.min(event.clientX - 10, window.innerWidth - 220) + 'px';
  tooltip.style.top = (event.clientY + 12) + 'px';
  tooltip.classList.remove('hidden');
  setTimeout(() => tooltip.classList.add('hidden'), 3000);
};

function setupOrgPanZoom() {
  const wrap = document.getElementById('orgChartWrap');
  const tree = document.getElementById('orgTree');
  if (!wrap || !tree) return;

  let scale = 1, startDist = 0, isDragging = false;
  let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

  wrap.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.pageX - wrap.offsetLeft;
    startY = e.pageY - wrap.offsetTop;
    scrollLeft = wrap.scrollLeft;
    scrollTop = wrap.scrollTop;
  });
  wrap.addEventListener('mousemove', e => {
    if (!isDragging) return;
    wrap.scrollLeft = scrollLeft - (e.pageX - wrap.offsetLeft - startX);
    wrap.scrollTop = scrollTop - (e.pageY - wrap.offsetTop - startY);
  });
  wrap.addEventListener('mouseup', () => { isDragging = false; });

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      scale = Math.min(2, Math.max(0.4, scale * (dist / startDist)));
      tree.style.transform = `scale(${scale})`;
      startDist = dist;
    }
  }, { passive: true });
}

window.resetOrgZoom = function() {
  const tree = document.getElementById('orgTree');
  if (tree) tree.style.transform = 'scale(1)';
};

window.copyReferralCode = function() {
  const code = document.getElementById('myReferralCode');
  if (code) navigator.clipboard.writeText(code.textContent).then(() => showToast('추천 코드 복사 완료!', 'success'));
};

window.shareReferralLink = function() {
  const code = userData?.referralCode || '';
  const url = location.origin + '?ref=' + code;
  if (navigator.share) {
    navigator.share({ title: 'DEEDRA 투자앱 초대', text: '추천 코드: ' + code, url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('초대 링크 복사 완료!', 'success'));
  }
};

// ===== 게임 =====
// gameBalanceVal = DDRA 단위 (bonusBalance(USDT) ÷ deedraPrice)
// 베팅값(oeBetVal 등)도 모두 DDRA 단위
// 실제 USDT 변화 = DDRA수 × deedraPrice
function _ddraToUsdt(ddra) { return ddra * (deedraPrice || 0.5); }
function _usdtToDdra(usdt) { return usdt / (deedraPrice || 0.5); }

function updateGameUI() {
  const bonus = walletData?.bonusBalance || 0;
  gameBalanceVal = Math.floor(_usdtToDdra(bonus) * 100) / 100; // DDRA
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('gameBalance', fmt(gameBalanceVal));
  setEl('gameBalanceUsd', '≈ $' + fmt(bonus));
}

// 충전 모달 관련 함수 - 더 이상 사용 안 함 (하위 호환성 유지)
window.chargeGameWallet = function() { /* 충전 시스템 제거됨 */ };
window.submitCharge = function() { /* 충전 시스템 제거됨 */ };

window.startGame = function(type) {
  if (gameBalanceVal <= 0) {
    showToast('게임 가능 DDRA가 없습니다. 투자 수익이 발생하면 바로 게임 가능합니다.', 'warning');
    return;
  }
  closeAllGames();
  const gameMap = { oddeven: 'gameOddEven', dice: 'gameDice', slot: 'gameSlot', roulette: 'gameRoulette', baccarat: 'gameBaccarat', poker: 'gamePoker' };
  const el = document.getElementById(gameMap[type]);
  if (el) el.classList.remove('hidden');

  // 슬라이더 최대값: DDRA 수량 기준
  const maxDdra = Math.max(1, Math.floor(gameBalanceVal));
  const slider = document.getElementById(type === 'oddeven' ? 'oeBetSlider' : type === 'dice' ? 'diceBetSlider' : 'slotBetSlider');
  if (slider) slider.max = maxDdra;

  // 게임별 초기화
  if (type === 'baccarat') {
    initBaccarat();
  }
  if (type === 'poker') {
    initPoker();
  }

  // 게임별 초기화
  if (type === 'dice') {
    renderDiceDots(6);
  }
  if (type === 'oddeven') {
    const coinText = document.getElementById('coinResultText');
    if (coinText) { coinText.textContent = '홀 또는 짝을 선택하세요'; coinText.style.color = ''; }
  }
  if (type === 'roulette') {
    initRouletteCanvas();
  }
};

function closeAllGames() {
  ['gameOddEven', 'gameDice', 'gameSlot', 'gameRoulette', 'gameBaccarat', 'gamePoker'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

window.closeGame = function() {
  closeAllGames();
  ['oeResult', 'diceResult', 'slotResult', 'rouletteResult', 'bacResult', 'pkResult'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.className = 'game-result-v2 hidden'; }
  });
};

window.updateBetDisplay = function(type, val) {
  val = Math.max(1, parseInt(val) || 1);
  const maxDdra = Math.max(1, Math.floor(gameBalanceVal));
  val = Math.min(val, maxDdra);
  const usdt = fmt(_ddraToUsdt(val));
  if (type === 'oe') {
    oeBetVal = val;
    const el = document.getElementById('oeCurrentBet'); if (el) el.textContent = val;
    const eu = document.getElementById('oeBetUsdt'); if (eu) eu.textContent = '≈$' + usdt;
  } else if (type === 'dice') {
    diceBetVal = val;
    const el = document.getElementById('diceCurrentBet'); if (el) el.textContent = val;
    const eu = document.getElementById('diceBetUsdt'); if (eu) eu.textContent = '≈$' + usdt;
  } else if (type === 'slot') {
    slotBetVal = val;
    const el = document.getElementById('slotCurrentBet'); if (el) el.textContent = val;
    const eu = document.getElementById('slotBetUsdt'); if (eu) eu.textContent = '≈$' + usdt;
  } else if (type === 'rl') {
    rlBetVal = val;
    const el = document.getElementById('rlCurrentBet'); if (el) el.textContent = val;
    const eu = document.getElementById('rlBetUsdt'); if (eu) eu.textContent = '≈$' + usdt;
  } else if (type === 'bac') {
    bacBetVal = val;
    const el = document.getElementById('bacCurrentBet'); if (el) el.textContent = val;
    const eu = document.getElementById('bacBetUsdt'); if (eu) eu.textContent = '≈$' + usdt;
  } else if (type === 'pk') {
    pkBetVal = val;
    const el = document.getElementById('pkCurrentBet'); if (el) el.textContent = val;
    const eu = document.getElementById('pkBetUsdt'); if (eu) eu.textContent = '≈$' + usdt;
  }
};

window.setBetAmount = function(type, val) {
  updateBetDisplay(type, val);
};

window.setBetGameHalf = function(type) {
  const maxDdra = Math.max(1, Math.floor(gameBalanceVal));
  setBetAmount(type, Math.max(1, Math.floor(maxDdra / 2)));
};

window.playOddEven = function(choice) {
  SFX.play('coin');
  if (gameBalanceVal < oeBetVal) { showToast('잔액 부족 (게임 가능 DDRA: ' + fmt(gameBalanceVal) + ')', 'error'); return; }

  const btnOdd = document.getElementById('oeBtnOdd');
  const btnEven = document.getElementById('oeBtnEven');
  if (btnOdd) btnOdd.disabled = true;
  if (btnEven) btnEven.disabled = true;

  const coin = document.getElementById('coinFlip');
  const coinText = document.getElementById('coinResultText');
  if (coin) {
    coin.classList.add('coin-flipping');
    if (coinText) coinText.textContent = '동전이 날아갑니다...';
  }

  setTimeout(() => {
    const result = Math.random() < 0.5 ? 'odd' : 'even';
    const userWins = houseRandom('oddeven');
    const win = userWins ? true : false;
    // 결과값은 유저 선택과 일치/불일치로 결정
    const forcedResult = win ? choice : (choice === 'odd' ? 'even' : 'odd');
    const betUsdt = _ddraToUsdt(oeBetVal);
    // DDRA 변화 반영 → bonusBalance(USDT) 동기화
    const ddraChange = win ? oeBetVal : -oeBetVal;
    const usdtChange = _ddraToUsdt(ddraChange);
    if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + usdtChange);
    updateGameUI();
    updateHomeUI();

    if (coin) coin.classList.remove('coin-flipping');
    if (coinText) {
      coinText.textContent = forcedResult === 'odd' ? '🔴 홀 (Odd)' : '🔵 짝 (Even)';
      coinText.style.color = forcedResult === 'odd' ? '#90caf9' : '#ef9a9a';
    }

    const el = document.getElementById('oeResult');
    SFX.play(win ? 'win' : 'lose');
    if (el) {
      el.className = 'game-result-v2 ' + (win ? 'win' : 'lose');
      el.innerHTML = win
        ? `🎉 <strong>승리!</strong> +${oeBetVal} DDRA (≈+${fmt(betUsdt)} USDT) &nbsp;·&nbsp; 결과: ${forcedResult === 'odd' ? '홀' : '짝'}`
        : `😢 <strong>패배</strong> -${oeBetVal} DDRA (≈-${fmt(betUsdt)} USDT) &nbsp;·&nbsp; 결과: ${forcedResult === 'odd' ? '홀' : '짝'}`;
      el.classList.remove('hidden');
    }

    if (btnOdd) btnOdd.disabled = false;
    if (btnEven) btnEven.disabled = false;
    logGame('홀짝', win, oeBetVal);
  }, 900);
};

window.playDice = function(chosenNum) {
  SFX.play('dice_roll');
  if (gameBalanceVal < diceBetVal) { showToast('잔액 부족 (게임 가능 DDRA: ' + fmt(gameBalanceVal) + ')', 'error'); return; }

  // 버튼 비활성화
  document.querySelectorAll('.dice-num-v2').forEach(b => b.disabled = true);

  // 초기 주사위 점 렌더링 (1 기본)
  renderDiceDots(1);

  // 3D 굴리기 애니메이션
  const dice3d = document.getElementById('dice3d');
  if (dice3d) {
    dice3d.classList.add('dice-rolling');
    // 굴리는 동안 랜덤 숫자 표시
    let flickerCount = 0;
    const flickerInterval = setInterval(() => {
      const randNum = Math.ceil(Math.random() * 6);
      renderDiceDots(randNum);
      flickerCount++;
      if (flickerCount > 8) clearInterval(flickerInterval);
    }, 100);
  }

  setTimeout(() => {
    const userWins = houseRandom('dice');
    // 유저가 이기면 선택한 숫자, 지면 다른 숫자
    const result = userWins
      ? chosenNum
      : (() => { const others = [1,2,3,4,5,6].filter(n => n !== chosenNum); return others[Math.floor(Math.random() * others.length)]; })();
    const win = userWins;
    const betUsdt = _ddraToUsdt(diceBetVal);
    const ddraChange = win ? diceBetVal * 5 : -diceBetVal;
    const usdtChange = _ddraToUsdt(ddraChange);
    if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + usdtChange);
    updateGameUI();
    updateHomeUI();

    if (dice3d) dice3d.classList.remove('dice-rolling');
    renderDiceDots(result);

    const el = document.getElementById('diceResult');
    SFX.play(win ? 'win' : 'lose');
    if (el) {
      el.className = 'game-result-v2 ' + (win ? 'win' : 'lose');
      el.innerHTML = win
        ? `🎉 <strong>적중! ×6</strong> +${diceBetVal * 5} DDRA (≈+${fmt(betUsdt * 5)} USDT) &nbsp;·&nbsp; 나온 숫자: ${result}`
        : `😢 <strong>빗나감</strong> -${diceBetVal} DDRA (≈-${fmt(betUsdt)} USDT) &nbsp;·&nbsp; 나온 숫자: ${result}`;
      el.classList.remove('hidden');
    }

    document.querySelectorAll('.dice-num-v2').forEach(b => b.disabled = false);
    logGame('주사위', win, diceBetVal);
  }, 1000);
};

window.playSpin = function() {
  SFX.play('slot_spin');
  if (gameBalanceVal < slotBetVal) { showToast('잔액 부족 (게임 가능 DDRA: ' + fmt(gameBalanceVal) + ')', 'error'); return; }

  const spinBtn = document.getElementById('spinBtn');
  if (spinBtn) { spinBtn.disabled = true; spinBtn.innerHTML = '<span class="spin-icon" style="display:inline-block;animation:spinRotate 0.3s linear infinite">🎰</span> 스피닝...'; }

  const reels = ['reel1', 'reel2', 'reel3'].map(id => document.getElementById(id));

  // 각 릴마다 다른 타이밍으로 스핀 시작
  reels.forEach((r, i) => {
    if (r) {
      setTimeout(() => r.classList.add('spinning'), i * 100);
    }
  });

  // 릴별로 다른 시점에 멈춤 (순차적으로)
  const stopTimes = [800, 1100, 1400];
  // 하우스 확률 적용: 유저가 이길지 먼저 결정
  const slotUserWins = houseRandom('slot');
  let result;
  if (slotUserWins) {
    // 유저 승리: 3개 같은 심볼 생성 (가중치: 낮은 배율 우선)
    const winSymbols = ['🍋','🍇','🍎','🍊','⭐','7️⃣','💎'];
    const sym = winSymbols[Math.floor(Math.random() * winSymbols.length)];
    result = [sym, sym, sym];
  } else {
    // 유저 패배: 3개 중 최소 하나는 다른 심볼
    do {
      result = [0,1,2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
    } while (result[0] === result[1] && result[1] === result[2]);
  }

  reels.forEach((r, i) => {
    setTimeout(() => {
      if (r) {
        r.classList.remove('spinning');
        r.textContent = result[i];
        // 멈출 때 잠깐 바운스
        r.style.transform = 'scale(1.15)';
        setTimeout(() => { if (r) r.style.transform = ''; }, 150);
      }
    }, stopTimes[i]);
  });

  setTimeout(() => {
    let multiplier = 0;
    if (result[0] === result[1] && result[1] === result[2]) {
      multiplier = result[0] === '💎' ? 50 : result[0] === '7️⃣' ? 20 : result[0] === '⭐' ? 10 : 5;
    }

    const win = multiplier > 0;
    const earned = win ? slotBetVal * multiplier : 0;
    const betUsdt = _ddraToUsdt(slotBetVal);
    const ddraChange = win ? earned : -slotBetVal;
    const usdtChange = _ddraToUsdt(ddraChange);
    if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + usdtChange);
    updateGameUI();
    updateHomeUI();

    if (win) {
      reels.forEach(r => { if (r) r.classList.add('win-flash'); });
      setTimeout(() => reels.forEach(r => { if (r) r.classList.remove('win-flash'); }), 1500);
      if (multiplier >= 10) spawnJackpotParticles();
    }

    const el = document.getElementById('slotResult');
    SFX.play(multiplier >= 10 ? 'jackpot' : (win ? 'win' : 'lose'));
    if (el) {
      el.className = 'game-result-v2 ' + (win ? 'win' : 'lose');
      el.innerHTML = win
        ? `🎉 <strong>잭팟! ×${multiplier}</strong> +${earned} DDRA (≈+${fmt(betUsdt * multiplier)} USDT)`
        : `😢 <strong>꽝!</strong> -${slotBetVal} DDRA (≈-${fmt(betUsdt)} USDT)`;
      el.classList.remove('hidden');
    }
    if (spinBtn) { spinBtn.disabled = false; document.getElementById('spinBtnIcon').textContent='🎰'; document.getElementById('spinBtnText').textContent='SPIN!'; spinBtn.disabled = false; }
    logGame('슬롯머신', win, slotBetVal);
  }, 1600);
};

// ===== 룰렛 =====

// 유럽식 룰렛 37칸 순서 (0 포함)
const ROULETTE_ORDER = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,
  24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];
const RL_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

let rlAngle = 0;           // 현재 각도
let rlAnimId = null;       // requestAnimationFrame id
let rlSpinning = false;

/* 숫자 → 색상 */
function rlColor(n) {
  if (n === 0) return '#1b5e20';
  return RL_RED.has(n) ? '#c62828' : '#212121';
}

/* Canvas 바퀴 그리기 */
function drawRouletteWheel(angle) {
  const canvas = document.getElementById('rouletteCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = W / 2 - 2;   // 바깥 반지름
  const rInner = R * 0.28; // 중앙 원 반지름
  const count = ROULETTE_ORDER.length; // 37
  const arc = (Math.PI * 2) / count;

  ctx.clearRect(0, 0, W, H);

  // ── 칸 그리기 ──
  for (let i = 0; i < count; i++) {
    const num = ROULETTE_ORDER[i];
    const startA = angle + i * arc - Math.PI / 2;
    const endA   = startA + arc;

    // 부채꼴 채우기
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startA, endA);
    ctx.closePath();
    ctx.fillStyle = rlColor(num);
    ctx.fill();

    // 칸 테두리
    ctx.strokeStyle = 'rgba(255,215,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 숫자 텍스트
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startA + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${num === 0 ? 12 : 11}px sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(String(num), R - 6, 4);
    ctx.restore();
  }

  // ── 구분선(금색 다이아몬드) 포인트 ──
  for (let i = 0; i < count; i++) {
    const a = angle + i * arc - Math.PI / 2;
    const x = cx + Math.cos(a) * (R - 2);
    const y = cy + Math.sin(a) * (R - 2);
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  }

  // ── 내부 원 ──
  // 그라데이션 배경
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  grad.addColorStop(0, '#2a1040');
  grad.addColorStop(0.6, '#1a0828');
  grad.addColorStop(1, '#0d0515');
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 내부 원 테두리
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 중앙 로고 텍스트
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 13px sans-serif';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 8;
  ctx.fillText('DEEDRA', cx, cy - 7);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(255,215,0,0.6)';
  ctx.shadowBlur = 0;
  ctx.fillText('ROULETTE', cx, cy + 8);
  ctx.restore();

  // ── 외부 링 그림자 ──
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,215,0,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* 초기화 */
function initRouletteCanvas() {
  rlAngle = 0;
  drawRouletteWheel(rlAngle);
  // 결과 초기화
  const res = document.getElementById('rouletteResult');
  if (res) { res.className = 'game-result-v2 hidden'; res.innerHTML = ''; }
  // 베팅 초기화
  rlSelectedBet = null;
  document.querySelectorAll('.rl-chip-btn, .rl-num-v2').forEach(b => b.classList.remove('selected'));
  const sv = document.getElementById('rlSelValue');
  if (sv) sv.textContent = '없음';
}

/* 베팅 탭 전환 */
window.switchRlTab = function(tab) {
  document.getElementById('rlPanelSimple').classList.toggle('hidden', tab !== 'simple');
  document.getElementById('rlPanelNumber').classList.toggle('hidden', tab !== 'number');
  document.getElementById('rlTabSimple').classList.toggle('active', tab === 'simple');
  document.getElementById('rlTabNumber').classList.toggle('active', tab === 'number');
};

/* 베팅 선택 */
window.selectRlBet = function(type) {
  rlSelectedBet = type;
  // 모든 선택 해제
  document.querySelectorAll('.rl-chip-btn, .rl-num-v2').forEach(b => b.classList.remove('selected'));
  // 해당 버튼 선택
  const btnId = type.startsWith('num') ? 'rlNum' + type.slice(3) : 'rlBtn' + type.charAt(0).toUpperCase() + type.slice(1);
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('selected');

  const labels = {
    red:'🔴 레드', black:'⚫ 블랙', zero:'🟢 제로(0)',
    odd:'홀수', even:'짝수', low:'1~18', high:'19~36',
    dozen1:'1st 12(1-12)', dozen2:'2nd 12(13-24)', dozen3:'3rd 12(25-36)'
  };
  const sv = document.getElementById('rlSelValue');
  if (sv) {
    if (type.startsWith('num')) {
      sv.textContent = `숫자 ${type.slice(3)} (×35)`;
    } else {
      sv.textContent = labels[type] || type;
    }
  }
};

/* 스핀 실행 */
window.playRoulette = function() {
  SFX.play('roulette_spin');
  if (!rlSelectedBet) { showToast('베팅을 먼저 선택하세요.', 'warning'); return; }
  if (gameBalanceVal < rlBetVal) { showToast('잔액 부족 (게임 가능 DDRA: ' + fmt(gameBalanceVal) + ')', 'error'); return; }
  if (rlSpinning) return;

  rlSpinning = true;
  const spinBtn = document.getElementById('rlSpinBtn');
  if (spinBtn) { spinBtn.disabled = true; spinBtn.innerHTML = '<span style="display:inline-block;animation:spinRotate 0.4s linear infinite">🎡</span> 스피닝...'; }

  // 하우스 확률 적용하여 결과 숫자 결정
  const rlUserWins = houseRandom('roulette');
  let resultNum;
  // 베팅 유형에 따라 이기는 숫자 집합과 지는 숫자 집합 분류
  const bet = rlSelectedBet;
  const winNums = ROULETTE_ORDER.filter(n => {
    if (bet === 'red')    return RL_RED.has(n);
    if (bet === 'black')  return n !== 0 && !RL_RED.has(n);
    if (bet === 'zero')   return n === 0;
    if (bet === 'odd')    return n !== 0 && n % 2 === 1;
    if (bet === 'even')   return n !== 0 && n % 2 === 0;
    if (bet === 'low')    return n >= 1 && n <= 18;
    if (bet === 'high')   return n >= 19 && n <= 36;
    if (bet === 'dozen1') return n >= 1 && n <= 12;
    if (bet === 'dozen2') return n >= 13 && n <= 24;
    if (bet === 'dozen3') return n >= 25 && n <= 36;
    if (bet.startsWith('num')) return n === parseInt(bet.slice(3));
    return false;
  });
  const loseNums = ROULETTE_ORDER.filter(n => !winNums.includes(n));
  if (rlUserWins && winNums.length > 0) {
    resultNum = winNums[Math.floor(Math.random() * winNums.length)];
  } else if (!rlUserWins && loseNums.length > 0) {
    resultNum = loseNums[Math.floor(Math.random() * loseNums.length)];
  } else {
    resultNum = ROULETTE_ORDER[Math.floor(Math.random() * ROULETTE_ORDER.length)];
  }

  // 결과 번호가 바퀴 상단(포인터 위치)에 오도록 목표 각도 계산
  const count = ROULETTE_ORDER.length;
  const arc   = (Math.PI * 2) / count;
  const idx   = ROULETTE_ORDER.indexOf(resultNum);
  // 목표: 해당 칸의 중앙이 -π/2(=상단)에 오도록 → angle = -(idx*arc + arc/2)
  const targetOffset = -(idx * arc + arc / 2);
  // 현재 각도 + 여러 바퀴(5~8 바퀴) + targetOffset
  const rounds = (5 + Math.floor(Math.random() * 4)) * Math.PI * 2;
  const targetAngle = rlAngle + rounds + (targetOffset - ((rlAngle) % (Math.PI * 2)));

  const duration = 5000; // 5초
  const startAngle = rlAngle;
  const startTime = performance.now();

  // easeOutCubic 감속
  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    rlAngle = startAngle + (targetAngle - startAngle) * easeOut(t);
    drawRouletteWheel(rlAngle);

    if (t < 1) {
      rlAnimId = requestAnimationFrame(animate);
    } else {
      // 스핀 완료
      rlAngle = targetAngle;
      drawRouletteWheel(rlAngle);
      rlSpinning = false;
      showRouletteResult(resultNum);
      if (spinBtn) { spinBtn.disabled = false; spinBtn.innerHTML = '🎡 다시 스핀!'; }
    }
  }

  rlAnimId = requestAnimationFrame(animate);
};

/* 결과 판정 */
function showRouletteResult(num) {
  const isRed   = RL_RED.has(num);
  const isBlack = num !== 0 && !isRed;
  const isZero  = num === 0;

  let win = false, multiplier = 0;
  const bet = rlSelectedBet;

  if (bet === 'red'    && isRed)               { win = true; multiplier = 2; }
  else if (bet === 'black'  && isBlack)         { win = true; multiplier = 2; }
  else if (bet === 'zero'   && isZero)          { win = true; multiplier = 35; }
  else if (bet === 'odd'    && num !== 0 && num % 2 === 1) { win = true; multiplier = 2; }
  else if (bet === 'even'   && num !== 0 && num % 2 === 0) { win = true; multiplier = 2; }
  else if (bet === 'low'    && num >= 1 && num <= 18)      { win = true; multiplier = 2; }
  else if (bet === 'high'   && num >= 19 && num <= 36)     { win = true; multiplier = 2; }
  else if (bet === 'dozen1' && num >= 1 && num <= 12)      { win = true; multiplier = 3; }
  else if (bet === 'dozen2' && num >= 13 && num <= 24)     { win = true; multiplier = 3; }
  else if (bet === 'dozen3' && num >= 25 && num <= 36)     { win = true; multiplier = 3; }
  else if (bet === 'num' + num)                            { win = true; multiplier = 35; }

  const betUsdt = _ddraToUsdt(rlBetVal);
  const earnedDdra  = win ? rlBetVal * multiplier : 0;
  const earnedUsdt = win ? _ddraToUsdt(earnedDdra) : 0;
  const ddraChange = win ? earnedDdra : -rlBetVal;
  const usdtChange = _ddraToUsdt(ddraChange);
  if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + usdtChange);
  updateGameUI();
  updateHomeUI();

  if (win && multiplier >= 10) spawnJackpotParticles();

  const numColor = isZero ? '#69f0ae' : isRed ? '#ef9a9a' : '#e0e0e0';
  SFX.play(win ? 'win' : 'lose');
  const el = document.getElementById('rouletteResult');
  if (el) {
    el.className = 'game-result-v2 ' + (win ? 'win' : 'lose');
    el.innerHTML = `
      <div class="rl-win-number" style="color:${numColor}">${num}</div>
      <div>${isZero ? '🟢 제로' : isRed ? '🔴 레드' : '⚫ 블랙'}</div>
      <div style="margin-top:6px;font-size:16px">
        ${win ? `🎉 <strong>승리! ×${multiplier} → +${fmt(earnedDdra)} DDRA (≈+${fmt(earnedUsdt)} USDT)</strong>` : `😢 <strong>패배 -${fmt(rlBetVal)} DDRA (≈-${fmt(betUsdt)} USDT)</strong>`}
      </div>`;
    el.classList.remove('hidden');
  }

  // 당첨 번호 하이라이트
  const numBtn = document.getElementById('rlNum' + num);
  if (numBtn) {
    numBtn.classList.add('selected');
    setTimeout(() => numBtn.classList.remove('selected'), 3000);
  }

  logGame('룰렛', win, rlBetVal);
}

function logGame(gameName, win, bet) {
  const listEl = document.getElementById('gameLogList');
  if (!listEl) return;

  const emptyEl = listEl.querySelector('.empty-state');
  if (emptyEl) emptyEl.remove();

  const item = document.createElement('div');
  item.className = 'tx-item';
  item.innerHTML = `
    <div class="tx-icon game">${win ? '🎉' : '😢'}</div>
    <div class="tx-info">
      <div class="tx-title">${gameName} ${win ? '승리' : '패배'}</div>
      <div class="tx-date">${new Date().toLocaleTimeString('ko-KR')}</div>
    </div>
    <div class="tx-amount ${win ? 'plus' : 'minus'}">
      ${win ? '+' : '-'}${fmt(bet)} DDRA
    </div>`;
  listEl.insertBefore(item, listEl.firstChild);

  // Firestore 실시간 동기화 (gamelogs 기록 + wallets bonusBalance 즉시 반영)
  if (!currentUser || !walletData) return;
  try {
    const { addDoc, collection, doc, updateDoc, db, serverTimestamp } = window.FB;
    const ddraChange = win ? bet : -bet;
    const usdtChange = _ddraToUsdt(ddraChange);
    const newBonus = Math.max(0, (walletData.bonusBalance || 0) + usdtChange);

    // gamelogs 컬렉션에 기록
    addDoc(collection(db, 'gamelogs'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      game: gameName,
      win,
      bet,
      betUsdt: _ddraToUsdt(bet),
      ddraChange,
      usdtChange,
      ddraPrice: deedraPrice || 0.5,
      createdAt: serverTimestamp()
    }).catch(() => {});

    // wallets bonusBalance 즉시 Firestore 반영
    updateDoc(doc(db, 'wallets', currentUser.uid), {
      bonusBalance: newBonus
    }).catch(() => {});

  } catch(e) { console.warn('[logGame] Firestore 저장 오류:', e); }
}

// ============================================================
// ===== 카드 덱 유틸리티 (바카라/포커 공용) =====
// ============================================================
const CARD_SUITS  = ['♠', '♥', '♦', '♣'];
const CARD_RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_IS_RED = new Set(['♥','♦']);

function makeDeck() {
  const deck = [];
  for (const s of CARD_SUITS)
    for (const r of CARD_RANKS)
      deck.push({ suit: s, rank: r });
  return deck;
}
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function cardHTML(card, delay = 0) {
  if (!card) return '<div class="play-card face-down"></div>';
  const isRed = CARD_IS_RED.has(card.suit);
  const colorCls = isRed ? 'red' : 'black';
  return `<div class="play-card ${colorCls} card-flip-in" style="animation-delay:${delay}s">
    <span class="card-rank">${card.rank}</span>
    <span class="card-suit">${card.suit}</span>
    <span class="card-rank-bot">${card.rank}</span>
  </div>`;
}

// ============================================================
// ===== 바카라 =====
// ============================================================
let bacDeck = [];
let bacBtnsLocked = false;

function bacCardValue(card) {
  if (['J','Q','K'].includes(card.rank)) return 0;
  if (card.rank === 'A') return 1;
  return Math.min(parseInt(card.rank), 9);
}
function bacHandScore(cards) {
  return cards.reduce((s, c) => s + bacCardValue(c), 0) % 10;
}
function bacNaturalCheck(score) { return score >= 8; }

function initBaccarat() {
  bacDeck = shuffleDeck(makeDeck().concat(makeDeck(), makeDeck(), makeDeck(), makeDeck(), makeDeck())); // 6덱
  bacBtnsLocked = false;
  ['bacPlayerCards','bacBankerCards'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = '';
  });
  ['bacPlayerScore','bacBankerScore'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '-';
  });
  const res = document.getElementById('bacResult');
  if (res) { res.className = 'game-result-v2 hidden'; res.innerHTML = ''; }
  document.querySelectorAll('.bac-action-btn').forEach(b => b.disabled = false);
}

window.playBaccarat = async function(betSide) {
  SFX.play('card_deal');
  if (bacBtnsLocked) return;
  if (gameBalanceVal < bacBetVal) { showToast('잔액 부족 (게임 가능 DDRA: ' + fmt(gameBalanceVal) + ')', 'error'); return; }

  bacBtnsLocked = true;
  document.querySelectorAll('.bac-action-btn').forEach(b => b.disabled = true);

  // 카드 딜링
  const pCards = [bacDeck.pop(), bacDeck.pop()];
  const bCards = [bacDeck.pop(), bacDeck.pop()];
  let pScore = bacHandScore(pCards);
  let bScore = bacHandScore(bCards);

  // 렌더링 (딜레이 애니)
  const pcEl = document.getElementById('bacPlayerCards');
  const bcEl = document.getElementById('bacBankerCards');
  if (pcEl) pcEl.innerHTML = cardHTML(pCards[0], 0) + cardHTML(pCards[1], 0.15);
  if (bcEl) bcEl.innerHTML = cardHTML(bCards[0], 0.3) + cardHTML(bCards[1], 0.45);

  const psEl = document.getElementById('bacPlayerScore');
  const bsEl = document.getElementById('bacBankerScore');
  if (psEl) psEl.textContent = pScore;
  if (bsEl) bsEl.textContent = bScore;

  await new Promise(r => setTimeout(r, 600));

  // 3번째 카드 규칙 (미니 바카라 표준)
  let p3, b3;
  if (!bacNaturalCheck(pScore) && !bacNaturalCheck(bScore)) {
    // 플레이어: 합 0-5이면 한 장 더
    if (pScore <= 5) {
      p3 = bacDeck.pop();
      pCards.push(p3);
      pScore = bacHandScore(pCards);
      if (pcEl) pcEl.innerHTML += cardHTML(p3, 0);
      if (psEl) psEl.textContent = pScore;
      await new Promise(r => setTimeout(r, 350));
    }
    // 뱅커 규칙
    let bankerDraw = false;
    if (p3 === undefined) {
      bankerDraw = bScore <= 5;
    } else {
      const p3v = bacCardValue(p3);
      if (bScore <= 2) bankerDraw = true;
      else if (bScore === 3 && p3v !== 8) bankerDraw = true;
      else if (bScore === 4 && p3v >= 2 && p3v <= 7) bankerDraw = true;
      else if (bScore === 5 && p3v >= 4 && p3v <= 7) bankerDraw = true;
      else if (bScore === 6 && p3v >= 6 && p3v <= 7) bankerDraw = true;
    }
    if (bankerDraw) {
      b3 = bacDeck.pop();
      bCards.push(b3);
      bScore = bacHandScore(bCards);
      if (bcEl) bcEl.innerHTML += cardHTML(b3, 0);
      if (bsEl) bsEl.textContent = bScore;
      await new Promise(r => setTimeout(r, 350));
    }
  }

  // 승패 판정 (하우스 확률 적용)
  let naturalOutcome = pScore > bScore ? 'player' : bScore > pScore ? 'banker' : 'tie';
  let outcome;
  if (betSide === 'tie') {
    // 타이 베팅: 하우스 확률로 타이 여부 결정
    outcome = houseRandom('baccarat') ? 'tie' : naturalOutcome !== 'tie' ? naturalOutcome : 'player';
  } else {
    // 플레이어/뱅커 베팅: 유저가 이기면 베팅한 쪽이 이기도록, 지면 반대쪽 or 타이
    const bacUserWins = houseRandom('baccarat');
    if (bacUserWins) {
      outcome = betSide; // 유저 베팅쪽 승리
    } else {
      // 유저 패배: 반대쪽 or 타이로 결정
      outcome = naturalOutcome !== betSide ? naturalOutcome : (betSide === 'player' ? 'banker' : 'player');
    }
  }

  // 배당 계산
  let win = false, multiplier = 0, resultMsg = '';
  if (betSide === 'player' && outcome === 'player') {
    win = true; multiplier = 2;
    resultMsg = `🎉 <strong>플레이어 승리!</strong> +${bacBetVal} DDRA`;
  } else if (betSide === 'banker' && outcome === 'banker') {
    win = true; multiplier = 1.95;
    resultMsg = `🎉 <strong>뱅커 승리!</strong> +${fmt(bacBetVal * 0.95)} DDRA (5% 수수료)`;
  } else if (betSide === 'tie' && outcome === 'tie') {
    win = true; multiplier = 8;
    resultMsg = `🎉 <strong>타이!</strong> +${bacBetVal * 8} DDRA`;
  } else if (outcome === 'tie') {
    win = false; multiplier = 0;
    resultMsg = `🤝 <strong>타이 - 푸쉬</strong> (베팅 반환)`;
    // 타이일 때 플레이어/뱅커 베팅은 환불
    win = true; multiplier = 1; // 원금 반환
  } else {
    resultMsg = outcome === 'player' ? `😢 <strong>플레이어 승, 뱅커 베팅 패배</strong> -${bacBetVal} DDRA`
                                     : `😢 <strong>뱅커 승, 플레이어 베팅 패배</strong> -${bacBetVal} DDRA`;
  }

  // 잔액 변경 (원금 반환은 변화 없음)
  const earned = win ? Math.floor(bacBetVal * multiplier) : 0;
  const ddraChange = win ? (earned - (multiplier === 1 ? 0 : bacBetVal)) : -bacBetVal;
  const usdtChange = _ddraToUsdt(ddraChange);
  if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + usdtChange);
  updateGameUI();
  updateHomeUI();

  // 승리 파티클
  if (win && multiplier >= 4) spawnJackpotParticles();

  // 결과 표시
  const resEl = document.getElementById('bacResult');
  if (resEl) {
    SFX.play(ddraChange >= 0 ? 'win' : 'lose');
    resEl.className = 'game-result-v2 ' + (ddraChange >= 0 ? 'win' : 'lose');
    resEl.innerHTML = `${resultMsg}<br><span style="font-size:12px;color:#94a3b8">플레이어 ${pScore} · 뱅커 ${bScore}</span>`;
    resEl.classList.remove('hidden');
  }

  logGame('바카라', ddraChange >= 0, Math.abs(ddraChange));

  // 버튼 재활성
  setTimeout(() => {
    bacBtnsLocked = false;
    document.querySelectorAll('.bac-action-btn').forEach(b => b.disabled = false);
    if (bacDeck.length < 20) bacDeck = shuffleDeck(makeDeck().concat(makeDeck(), makeDeck(), makeDeck(), makeDeck(), makeDeck()));
  }, 1500);
};

// ============================================================
// ===== 텍사스 홀덤 포커 =====
// ============================================================
let pkDeck = [];
let pkDealing = false;

// 카드 숫자값 (포커용)
function pkCardValue(card) {
  if (card.rank === 'A') return 14;
  if (card.rank === 'K') return 13;
  if (card.rank === 'Q') return 12;
  if (card.rank === 'J') return 11;
  return parseInt(card.rank);
}

// 핸드 평가 (7장 중 최강 5장)
function evaluatePokerHand(cards) {
  // 숫자값 + 수트 분류
  const vals = cards.map(pkCardValue).sort((a,b) => b-a);
  const suits = cards.map(c => c.suit);
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s]||0)+1);
  const flushSuit = Object.entries(suitCounts).find(([,v])=>v>=5)?.[0];

  // 숫자 카운트
  const valCounts = {};
  vals.forEach(v => valCounts[v] = (valCounts[v]||0)+1);
  const counts = Object.values(valCounts).sort((a,b)=>b-a);
  const uniqueVals = [...new Set(vals)].sort((a,b)=>b-a);

  // 플러시 카드 추출
  const flushCards = flushSuit ? cards.filter(c=>c.suit===flushSuit).map(pkCardValue).sort((a,b)=>b-a) : [];

  // 스트레이트 체크 (Ace 로우 포함)
  function isStraight(sortedVals) {
    const u = [...new Set(sortedVals)];
    // A-2-3-4-5 (휠)
    if (u.includes(14) && u.includes(2) && u.includes(3) && u.includes(4) && u.includes(5)) return 5;
    for (let i=0; i<=u.length-5; i++) {
      if (u[i]-u[i+4]===4 && new Set(u.slice(i,i+5)).size===5) return u[i];
    }
    return 0;
  }

  const straight = isStraight(vals);
  const straightFlush = flushSuit ? isStraight(flushCards) : 0;
  const royalFlush = straightFlush === 14;

  if (royalFlush)    return { rank: 9, name: '🏆 로열 플러시', multiplier: 100 };
  if (straightFlush) return { rank: 8, name: '💎 스트레이트 플러시', multiplier: 50 };
  if (counts[0]===4) return { rank: 7, name: '🎴 포카드', multiplier: 25 };
  if (counts[0]===3 && counts[1]===2) return { rank: 6, name: '🏠 풀 하우스', multiplier: 9 };
  if (flushSuit)     return { rank: 5, name: '🌊 플러시', multiplier: 6 };
  if (straight)      return { rank: 4, name: '📈 스트레이트', multiplier: 4 };
  if (counts[0]===3) return { rank: 3, name: '🎲 쓰리 카드', multiplier: 3 };
  if (counts[0]===2 && counts[1]===2) return { rank: 2, name: '✌️ 투 페어', multiplier: 2 };
  if (counts[0]===2) {
    // 원 페어: J이상이면 1.5배, 아니면 패배
    const pairVal = parseInt(Object.entries(valCounts).find(([,v])=>v===2)?.[0]);
    if (pairVal >= 11) return { rank: 1, name: `🃏 원 페어 (${pairVal===11?'J':pairVal===12?'Q':pairVal===13?'K':'A'}+)`, multiplier: 1.5 };
  }
  // 하이카드
  const highCardName = uniqueVals[0]===14?'A':uniqueVals[0]===13?'K':uniqueVals[0]===12?'Q':uniqueVals[0]===11?'J':String(uniqueVals[0]);
  return { rank: 0, name: `❌ 하이카드 (${highCardName})`, multiplier: 0 };
}

function initPoker() {
  pkDeck = shuffleDeck(makeDeck());
  pkDealing = false;
  ['pkCommunityCards','pkDealerCards','pkPlayerCards'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = '';
  });
  ['pkDealerHand','pkPlayerHand'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '-';
  });
  const res = document.getElementById('pkResult');
  if (res) { res.className = 'game-result-v2 hidden'; res.innerHTML = ''; }
  const btn = document.getElementById('pkDealBtn');
  if (btn) { btn.disabled = false; btn.textContent = '🃏 딜 (카드 받기)'; }
}

window.dealPoker = async function() {
  SFX.play('card_deal');
  if (pkDealing) return;
  if (gameBalanceVal < pkBetVal) { showToast('잔액 부족 (게임 가능 DDRA: ' + fmt(gameBalanceVal) + ')', 'error'); return; }

  pkDealing = true;
  const btn = document.getElementById('pkDealBtn');
  if (btn) { btn.disabled = true; btn.textContent = '🃏 딜링...'; }

  if (pkDeck.length < 20) pkDeck = shuffleDeck(makeDeck());

  // 카드 배분 (딜러2 + 플레이어2 + 커뮤니티5)
  const playerHand = [pkDeck.pop(), pkDeck.pop()];
  const dealerHand = [pkDeck.pop(), pkDeck.pop()];
  const community  = [pkDeck.pop(), pkDeck.pop(), pkDeck.pop(), pkDeck.pop(), pkDeck.pop()];

  // 딜러 핸드 - 처음엔 뒤집어서 표시
  const dcEl = document.getElementById('pkDealerCards');
  if (dcEl) dcEl.innerHTML = '<div class="play-card face-down"></div><div class="play-card face-down"></div>';

  // 플레이어 카드 표시
  const pcEl = document.getElementById('pkPlayerCards');
  if (pcEl) pcEl.innerHTML = cardHTML(playerHand[0], 0) + cardHTML(playerHand[1], 0.15);

  await new Promise(r => setTimeout(r, 500));

  // 커뮤니티 카드 순차 공개 (플롭→턴→리버)
  const ccEl = document.getElementById('pkCommunityCards');
  if (ccEl) {
    ccEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, i < 3 ? 200 : 400));
      ccEl.innerHTML += cardHTML(community[i], 0);
    }
  }

  await new Promise(r => setTimeout(r, 400));

  // 딜러 카드 공개
  if (dcEl) dcEl.innerHTML = cardHTML(dealerHand[0], 0) + cardHTML(dealerHand[1], 0.15);

  await new Promise(r => setTimeout(r, 400));

  // 핸드 평가 (플레이어: 2 + 커뮤니티5 = 7장 중 최강)
  const playerResult = evaluatePokerHand([...playerHand, ...community]);
  const dealerResult = evaluatePokerHand([...dealerHand, ...community]);

  const phEl = document.getElementById('pkPlayerHand');
  const dhEl = document.getElementById('pkDealerHand');
  if (phEl) phEl.textContent = playerResult.name;
  if (dhEl) dhEl.textContent = dealerResult.name;

  // 승패: 플레이어 핸드 랭크 vs 딜러 핸드 랭크
  // 딜러는 원 페어 미만이면 퀄리파이 실패 → 앤티만 돌려받음
  let win = false, ddraChange = 0, resultMsg = '';
  const dealerQualified = dealerResult.rank >= 1; // 원 페어 이상

  if (!dealerQualified) {
    // 딜러 퀄리파이 실패: 앤티 반환 (원금 유지)
    ddraChange = 0;
    resultMsg = `🤝 <strong>딜러 퀄리파이 실패!</strong> 앤티 반환<br><span style="font-size:11px;color:#94a3b8">딜러: ${dealerResult.name}</span>`;
    win = true;
  } else if (playerResult.multiplier === 0) {
    // 하이카드 패배
    ddraChange = -pkBetVal;
    resultMsg = `😢 <strong>패배</strong> -${pkBetVal} DDRA<br><span style="font-size:11px;color:#94a3b8">내 패: ${playerResult.name}</span>`;
  } else if (playerResult.rank > dealerResult.rank) {
    // 플레이어 승 → 배당 지급
    const earned = Math.floor(pkBetVal * playerResult.multiplier);
    ddraChange = earned - pkBetVal; // 순이익
    win = true;
    resultMsg = `🎉 <strong>${playerResult.name}!</strong> +${ddraChange} DDRA (×${playerResult.multiplier})<br><span style="font-size:11px;color:#94a3b8">딜러: ${dealerResult.name}</span>`;
  } else if (playerResult.rank < dealerResult.rank) {
    // 딜러 승
    ddraChange = -pkBetVal;
    resultMsg = `😢 <strong>딜러 승</strong> -${pkBetVal} DDRA<br><span style="font-size:11px;color:#94a3b8">딜러: ${dealerResult.name} · 나: ${playerResult.name}</span>`;
  } else {
    // 동점: 원금 반환
    ddraChange = 0;
    resultMsg = `🤝 <strong>동점 - 타이!</strong> 베팅 반환<br><span style="font-size:11px;color:#94a3b8">${playerResult.name}</span>`;
    win = true;
  }

  // 잔액 업데이트
  const usdtChange = _ddraToUsdt(ddraChange);
  if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + usdtChange);
  updateGameUI();
  updateHomeUI();

  if (win && playerResult.rank >= 7) spawnJackpotParticles();

  const resEl = document.getElementById('pkResult');
  if (resEl) {
    SFX.play(ddraChange >= 0 ? (playerResult.rank >= 7 ? 'jackpot' : 'win') : 'lose');
    resEl.className = 'game-result-v2 ' + (ddraChange >= 0 ? 'win' : 'lose');
    resEl.innerHTML = resultMsg;
    resEl.classList.remove('hidden');
  }

  logGame('포커', ddraChange >= 0, Math.abs(ddraChange));

  setTimeout(() => {
    pkDealing = false;
    if (btn) { btn.disabled = false; btn.textContent = '🃏 다시 딜!'; }
  }, 1000);
};

// ===== 마이페이지 (More 탭 내) =====
window.showProfileEdit = function() {
  if (!userData) return;
  const nameEl = document.getElementById('editName');
  const phoneEl = document.getElementById('editPhone');
  if (nameEl) nameEl.value = userData.name || '';
  if (phoneEl) phoneEl.value = userData.phone || '';
  document.getElementById('profileModal').classList.remove('hidden');
};

window.saveProfile = async function() {
  const name = document.getElementById('editName').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  if (!name) { showToast('이름을 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '저장 중...';
  try {
    const { doc, updateDoc, db } = window.FB;
    await updateDoc(doc(db, 'users', currentUser.uid), { name, phone });
    userData.name = name; userData.phone = phone;
    closeModal('profileModal');
    showToast('프로필이 저장되었습니다.', 'success');
    loadMorePage();
    updateHomeUI();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '저장';
  }
};

window.showPasswordChange = function() {
  showToast('비밀번호 변경 이메일을 발송했습니다.', 'info');
  const { sendPasswordResetEmail, auth } = window.FB;
  if (currentUser) sendPasswordResetEmail(auth, currentUser.email).catch(() => {});
};

window.showWithdrawPinSetup = function() {
  document.getElementById('newPin').value = '';
  document.getElementById('confirmPin').value = '';
  document.getElementById('pinModal').classList.remove('hidden');
};

window.saveWithdrawPin = async function() {
  const pin = document.getElementById('newPin').value;
  const confirm = document.getElementById('confirmPin').value;
  if (!pin || pin.length !== 6) { showToast('6자리 PIN을 입력하세요.', 'warning'); return; }
  if (pin !== confirm) { showToast('PIN이 일치하지 않습니다.', 'error'); return; }
  if (!/^\d{6}$/.test(pin)) { showToast('숫자 6자리를 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true;
  try {
    const { doc, updateDoc, db } = window.FB;
    await updateDoc(doc(db, 'users', currentUser.uid), { withdrawPin: btoa(pin) });
    userData.withdrawPin = btoa(pin);
    closeModal('pinModal');
    showToast('출금 PIN이 설정되었습니다.', 'success');
  } catch (err) {
    showToast('설정 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
};

window.showTickets = async function() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  document.getElementById('ticketModal').classList.remove('hidden');
  const listEl = document.getElementById('ticketList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';

  try {
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!tickets.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state">문의 내역이 없습니다</div>';
      return;
    }
    if (listEl) listEl.innerHTML = tickets.map(t => `
      <div class="ticket-item">
        <div class="ticket-title">${t.title}</div>
        <div class="ticket-meta">${fmtDate(t.createdAt)}</div>
        <span class="ticket-status-badge ${t.status === 'closed' ? 'ticket-closed' : 'ticket-open'}">
          ${t.status === 'closed' ? '답변 완료' : '처리 중'}
        </span>
      </div>`).join('');
  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
};

window.submitTicket = async function() {
  const title = document.getElementById('ticketTitle').value.trim();
  const content = document.getElementById('ticketContent').value.trim();
  if (!title || !content) { showToast('제목과 내용을 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '등록 중...';
  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'tickets'), {
      userId: currentUser.uid, userEmail: currentUser.email,
      title, content, status: 'open', createdAt: serverTimestamp(),
    });
    document.getElementById('ticketTitle').value = '';
    document.getElementById('ticketContent').value = '';
    closeModal('ticketModal');
    showToast('문의가 등록되었습니다.', 'success');
  } catch (err) {
    showToast('등록 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '문의 등록';
  }
};

// ===== 알림 시스템 =====
let _notiUnsubscribe = null;

// 앱 시작 시 실시간 알림 리스너 등록 (initApp에서 호출)
async function startNotificationListener() {
  if (!currentUser) return;
  const { collection, query, where, orderBy, onSnapshot, db, limit } = window.FB;
  if (_notiUnsubscribe) _notiUnsubscribe(); // 기존 리스너 해제
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    _notiUnsubscribe = onSnapshot(q, (snap) => {
      const count = snap.size;
      const badge = document.getElementById('notiBadge');
      if (badge) {
        if (count > 0) { badge.classList.remove('hidden'); badge.textContent = count > 9 ? '9+' : count; }
        else { badge.classList.add('hidden'); badge.textContent = ''; }
      }
    }, () => {});
  } catch(e) { console.warn('[Noti] 리스너 오류:', e); }
}

window.showNotifications = async function() {
  const { collection, query, where, orderBy, getDocs, doc, updateDoc, writeBatch, db, limit, serverTimestamp } = window.FB;
  const modal = document.getElementById('notiModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const listEl = document.getElementById('notiList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // 읽지 않은 알림 일괄 읽음 처리
    const unread = snap.docs.filter(d => !d.data().isRead);
    if (unread.length > 0) {
      const batch = writeBatch(db);
      unread.forEach(d => batch.update(doc(db, 'notifications', d.id), { isRead: true }));
      await batch.commit();
    }
    if (!items.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><br>알림이 없습니다</div>';
      return;
    }
    const notiIcons = { deposit: '💰', withdrawal: '💸', bonus: '🎁', invest: '📈', system: '📢', game: '🎮', rank: '⭐' };
    if (listEl) listEl.innerHTML = items.map(n => `
      <div class="noti-item ${n.isRead ? '' : 'unread'}">
        <div class="noti-icon">${notiIcons[n.type] || '🔔'}</div>
        <div class="noti-body">
          <div class="noti-title">${n.title || '알림'}</div>
          <div class="noti-msg">${n.message || ''}</div>
          <div class="noti-date">${fmtDate(n.createdAt)}</div>
        </div>
      </div>
    `).join('');
  } catch(e) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">알림을 불러올 수 없습니다</div>';
  }
};

// ===== 모달 =====
window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

// ===== 유틸 =====
function generateReferralCode(uid) {
  return 'DD' + uid.substring(0, 6).toUpperCase();
}

async function findUserByReferralCode(code) {
  const { collection, query, where, getDocs, db } = window.FB;
  try {
    const q = query(collection(db, 'users'), where('referralCode', '==', code));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  } catch { return null; }
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0.00';
  return parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString('ko-KR');
}

function fmtDate(ts) {
  if (!ts) return '-';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) +
           ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
}

function fmtDateShort(d) {
  try {
    const dt = d?.toDate ? d.toDate() : d instanceof Date ? d : new Date(d);
    return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return '-'; }
}

function getDaysLaterStr(days) {
  const d = new Date(Date.now() + days * 86400000);
  return fmtDateShort(d);
}

function getTxTypeName(type) {
  const map = { deposit: 'USDT 입금', withdrawal: 'DEEDRA 출금', bonus: '보너스 지급', invest: '투자 신청', game: '게임', referral: '추천 보너스' };
  return map[type] || type;
}

function getAuthErrorMsg(code) {
  const map = {
    'auth/invalid-email': '유효하지 않은 이메일입니다.',
    'auth/user-not-found': '등록되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/weak-password': '비밀번호가 너무 약합니다. 6자 이상으로 설정하세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/invalid-login-credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/invalid_login_credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '너무 많은 요청이 있었습니다. 잠시 후 다시 시도하세요.',
    'auth/too-many-attempts-try-later': '너무 많은 시도가 있었습니다. 잠시 후 다시 시도하세요.',
    'auth/network-request-failed': '네트워크 오류가 발생했습니다.',
    'auth/user-disabled': '비활성화된 계정입니다. 관리자에게 문의하세요.',
  };
  // REST API 에러 코드 직접 매핑 (auth/ 없는 경우)
  if (!code) return '로그인 중 오류가 발생했습니다.';
  const normalized = code.toLowerCase().replace(/_/g, '-');
  if (map[code]) return map[code];
  if (map['auth/' + normalized]) return map['auth/' + normalized];
  if (normalized.includes('invalid') && normalized.includes('credential')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (normalized.includes('too-many')) return '너무 많은 시도가 있었습니다. 잠시 후 다시 시도하세요.';
  return '오류가 발생했습니다: ' + code;
}

// ===== 토스트 =====
let toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  if (toastTimer) { clearTimeout(toastTimer); el.classList.remove('show'); }
  setTimeout(() => {
    el.textContent = msg;
    el.className = `toast show ${type}`;
    toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3200);
  }, 50);
}

console.log('✅ DEEDRA app.js v2.0 로드 완료');
