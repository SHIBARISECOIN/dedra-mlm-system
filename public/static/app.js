/**
 * DEEDRA 회원용 앱 v2.0 - 메인 로직
 * UI 설계안 기반 전면 개편
 */

// ===== 사운드 엔진 (Web Audio API) =====
const SFX = (() => {
  const audioUrls = {
    'click': '/static/audio/coin_flip.mp3', // Shortened or reused? Wait, click should just be simple. Let's use AudioContext for click, it's very fast and clean.
    'coin': '/static/audio/coin_flip.mp3',
    'dice_roll': '/static/audio/dice_roll.mp3',
    'slot_spin': '/static/audio/slot_spin.mp3',
    'card_deal': '/static/audio/card_deal.mp3',
    'roulette_spin': '/static/audio/roulette_spin.mp3',
    'win': '/static/audio/win.mp3',
    'lose': '/static/audio/lose.mp3'
  };

  const audioObjects = {};
  
  // Preload all audio
  for (const [key, url] of Object.entries(audioUrls)) {
    if (key !== 'click') {
      const a = new Audio(url);
      a.preload = 'auto';
      audioObjects[key] = a;
    }
  }

  let ctx = null;
  const initCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  };

  const play = (type) => {
    try {
      if (type === 'click') {
        initCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(1200, t); o.frequency.exponentialRampToValueAtTime(600, t+0.06);
        g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.06);
        o.start(t); o.stop(t+0.06);
        return;
      }
      
      const audio = audioObjects[type];
      if (audio) {
        // Clone the node so we can play overlapping sounds
        const clone = audio.cloneNode();
        clone.volume = 0.6; // Adjust volume as needed
        clone.play().catch(e => console.warn('SFX play failed', e));
      }
    } catch(e) { console.warn('SFX Error:', e); }
  };

  return { play };
})();

// ===== 다국어(i18n) 번역 데이터 =====
const TRANSLATIONS = {
  ko: {
    errWithdrawTime: '지금은 출금 가능 시간이 아닙니다.\n{day} {time} 부터 출금 가능합니다.',
    errWithdrawTimeToday: '지금은 출금 가능 시간이 아닙니다.\n오늘 {time} 부터 출금 가능합니다.',
    errWithdrawRestricted: '현재 출금이 제한되어 있습니다.',
    dayTomorrow: '내일',
    dayDayAfter: '모레',
    dayNextWeek: '다음 주 {day}요일',
    daySun: '일', dayMon: '월', dayTue: '화', dayWed: '수', dayThu: '목', dayFri: '금', daySat: '토',
    
    upbitRealTime: 'Upbit 실시간',
    loadingPrice: '시세 불러오는 중...',
    coin_BTC: '비트코인',
    coin_ETH: '이더리움',
    coin_SOL: '솔라나',
    coin_XRP: '리플',
    coin_DOGE: '도지코인',
    coin_SHIB: '시바이누',
    coin_ADA: '에이다',
    coin_AVAX: '아발란체',
    noSubMembers: '산하 회원이 없습니다.',
    orgDepthLimitTitle: '조직도 열람 권한 제한',
    orgDepthLimitDesc: '현재 <strong>{rank}</strong> 직급은 <strong>{depth}대</strong>까지만 열람할 수 있습니다.<br>직급을 승급하여 더 깊은 산하 파트너를 확인해 보세요! 🚀',

    diceHint: '숫자를 선택하여 베팅하세요',
    earnSeeAll: '수익 전체보기',
    freezingNow: '❄️ 진행중',
    gameStartHint: '칩을 선택하여 베팅하세요',
    labelCountry: '국가',
    netPerfAll: '산하 조직 실적',
    netPerfGen1: '1대 조직 실적',
    netPerfGen2: '2대 조직 실적',
    networkDetail: '조직 상세',
    globalNetworkMap: '🌍 글로벌 라이브 네트워크',
    networkEarnings: '네트워크 수익',
    playWithEarn: '수익으로 즉시 플레이',
    rank_next_label: '다음 직급:',
    rank_referral: '추천인',
    rank_referral_unit: '명',
    subMembers: '하부 인원',
    todayEarn: '당일 수익',
    todayEarnLabel: '오늘 수익',
    todayEarnSummary: 'TODAY 당일 수익 요약',
    totalEarnSum: '전체 당일 수익 합계',
    totalEarnings: '누적 수익',
    totalSubMembersEarn: '총 하부 인원 · 누적 수익',
    viewDetail: '상세보기 ›',
    withdrawNoticeText: '※ 처리 완료까지 1-3일 소요',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: '출금 가능 DDRA',
    withdrawableDdraLabel: '출금 가능 DDRA',
    tabGen1: '1대 조직',
    tabGen2: '2대 조직',
    tabDeep: '산하 조직',
    tabTx: '거래내역',
    emptySubGen: '{gen}대 하부 멤버가 없습니다',
    emptyDeepGen: '3대 이하 하부 멤버가 없습니다',
    genSub: '{gen}대 하부',
    orgTitle: '하부 {n}명 조직 수익 현황',
    myInvestTitle: '📋 내 FREEZE 현황',
    emptyInvest: '진행 중인 FREEZE가 없습니다',
    dailyReturnLabel: '❄️ 일 수익:',
    remainDaysLabel: '잔여 {n}일',
    totalExpectedLabel: '총 예상수익(일): +{n} USDT (원금은 만기 후 출금 가능)',
    investUnit: '건',
    perDay: '/일',
    productMonth1: '1개월',
    productMonth3: '3개월',
    productMonth6: '6개월',
    productMonth12: '12개월',
    productHint1: '{min} USDT FREEZE 시 일 수익',
    productHint2: '만기 후 언프리즈 가능',
    ddraConvert: 'DDRA 환산',
    maturityDate: '만기일',
    emptyNotice: '공지사항이 없습니다',
    loadFail: '불러오기 실패',
        emptyTx: '거래 내역이 없습니다',
    chatTabGroup: '내 그룹',
    chatTabUpline: '스폰서',
    chatNoSponsor: '스폰서가 없습니다.',
    chatFirstMessage: '첫 메시지를 보내보세요!',
    chatInputPlaceholder: '메시지를 입력하세요...',
    chatSendFail: '메시지 전송 실패',
    chatNewMessage: '새 메시지가 도착했습니다.',
    chatPageTitle: '채팅',
    fee: '수수료',
    globalNetwork: '실시간 글로벌 네트워크',
    majorCryptoPrice: 'Major Crypto Live Price',
    majorCryptoPrice: '주요 암호화폐 실시간 시세',
    newsViewerTitle: '📰 뉴스 보기',
    tickerJoined: '새로운 회원이 가입했습니다: {city}',
    tickerDeposited: '{city}에서 {amt} USDT 입금',
    tickerUpgraded: '{city}에서 직급 승급',
    tickerFreeze: '{city}에서 {amt} USDT FREEZE',
    emptyBonus: '수익 내역이 없습니다',
    emptyBonusSub: '관리자가 일일 정산을 실행하면 여기에 표시됩니다.',
    emptyProducts: 'FREEZE 플랜이 없습니다',
    emptyNoti: '알림이 없습니다',
    emptyTicket: '문의 내역이 없습니다',
    emptyRef: '추천인이 없습니다',
    notiTitleMature: '✅ FREEZE 만기 완료',
    notiMsgMature: '[{name}] FREEZE 계약이 만료되었습니다. 원금 {amt} USDT가 지갑에 언프리즈되었습니다.',
    toastMature: '❄️ 만기 FREEZE {n}건의 원금이 언프리즈되었습니다.',
  
    // 로그인/회원가입
    authTagline: '🔐 안전하고 스마트한 가상자산 FREEZE',
    loginTab: '로그인',
    registerTab: '회원가입',
    labelUsername: '아이디',
    labelEmail: '이메일',
    labelPassword: '비밀번호',
    placeholderUsername: '아이디를 입력하세요',
    placeholderEmail: '이메일을 입력하세요',
    placeholderPassword: '비밀번호를 입력하세요',
    placeholderPasswordMin: '6자리 이상 입력하세요',
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
    btnWithdraw: '출금하기 (USDT)',
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
    activeInvest: '활성 FREEZE',
    totalInvest: '전체 FREEZE',
    expectedReturnLabel: '예상 수익',
    simTitle: '❄️ FREEZE 수익 시뮬레이터',
    simSelectProduct: '상품 선택',
    simUsdtAmount: 'USDT 금액',
    simInvestAmount: 'FREEZE 금액',
    simPeriod: '기간',
    simRoi: '수익률',
    simEarning: '일 수익 (USDT)',
    simEarningUsd: '총 수익 (USDT)',
    productListTitle: '❄️ FREEZE 플랜',
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
    betOddBtn: '홀 (Odd)',
    betEvenBtn: '짝 (Even)',
    newsTitle: '📰 뉴스',
    refresh: '새로고침',
    peopleUnit: '명',
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
    depositAddrLabel: '회사 입금 주소 (Solana SPL)',
    depositAddrLoading: '주소 로딩중...',
    depositAmountLabel: '입금 금액 (USDT)',
    depositTxidLabel: 'TXID (트랜잭션 해시)',
    depositTxidPlaceholder: '트랜잭션 해시 입력',
    depositMemoLabel: '메모 (선택)',
    depositMemoPlaceholder: '메모 입력 (선택)',
    depositWarning: '⚠️ 반드시 위 주소로 입금 후 TXID를 입력해주세요. 관리자 승인 후 잔액이 업데이트됩니다.',
    btnCancel: '취소',
    btnSubmitDeposit: '입금 신청',
    modalWithdraw: '💸 수익 출금 신청 (USDT 기준)',
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
    toastPwMin: '비밀번호는 6자리 이상(영문/숫자 조합 권장)이어야 합니다.',
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
    cancel: '취소',
    confirm: '확인',
    failPrefix: '신청 실패: ',
    saveFail: '저장 실패: ',
    regFail: '등록 실패: ',
    days: '일',
    units: '건',
    emptyProducts: '상품 없음',
    emptyAnnounce: '공지사항이 없습니다',
    emptyTx: '거래 내역이 없습니다',
    emptyBonus: '수익 내역이 없습니다',
    emptyBonusSub: '관리자가 일일 정산을 실행하면 여기에 표시됩니다.',
    emptyNotice: '공지사항을 찾을 수 없습니다.',
    loadFail: '불러오기 실패',
    loading: '불러오는 중...',
    noTitle: '제목 없음',
    noContent: '내용 없음',
    pinBadge: '공지',
    statusPending: '승인 대기',
    statusApproved: '완료',
    statusRejected: '거부됨',
    greetingDawn: '새벽에도 열심히네요 🌙',
    greetingMorning: '좋은 아침이에요 ☀️',
    greetingAfternoon: '안녕하세요 👋',
    greetingEvening: '좋은 저녁이에요 🌆',
    freezeOngoing: 'FREEZE 진행 중',
    daysRemain: '일 남음',
    dailyRoi: '일 수익률',
    perioDays: '일',
    minAmount: '최소 $',
    bonusRoiIncome: '❄️ FREEZE ROI 수익',
    bonusDirectBonus: '👥 추천 매칭',
    bonusUnilevelBonus: '🌐 유니레벨 보너스',
    bonusRankBonus: '🏆 판권 매칭',
    bonusDefault: '보너스',
    bonusSettleDate: '정산일: ',
    bonusLevel: '단계',
    bonusBaseIncome: '기준 D: $',
    bonusCompleted: '완료',
    winText: '승리',
    loseText: '패배',
    priceUpdated: '업데이트: ',
    walletConnecting: '연결 중...',
    walletInquiring: '조회중...',
    walletConnected: '연결됨',
    walletNoWallet: '❌ 지갑이 감지되지 않습니다.\nPhantom 또는 TokenPocket을 설치해주세요.',
    walletCancelConnect: '연결을 취소했습니다.',
    walletMovingApp: '앱으로 이동합니다...',
    walletConnectFirst: '먼저 지갑을 연결하세요.',
    walletMinDeposit: '최소 입금액은 $1 USDT입니다.',
    walletNoCompanyAddr: '❌ 회사 지갑 주소가 설정되지 않았습니다.',
    walletProcessing: '⏳ 처리 중...',
    walletSigning: '🔐 지갑 서명 요청 중... (지갑 팝업을 확인하세요)',
    walletVerifying: '📡 온체인 확인 중... (최대 30초 소요)',
    walletDepositComplete: '✅ 입금 완료! 잔액이 자동으로 업데이트되었습니다.',
    walletDepositPending: '⏳ 전송 완료! 관리자 확인 후 승인됩니다.',
    walletTransferDone: '전송 완료! 관리자 확인 후 승인됩니다.',
    walletCancelSign: '서명을 취소했습니다.',
    walletDisconnected: '지갑 연결이 끊겼습니다. 다시 연결해주세요.',
    walletInsufficientSol: '❌ USDT 또는 SOL 잔액이 부족합니다.',
    walletInsufficientSolMsg: '❌ 잔액이 부족합니다 (USDT 또는 수수료용 SOL 확인)',
    walletTransferFail: '전송 실패',
    walletBtnSend: '🚀 지갑으로 즉시 전송',
    walletBtnConnect: '👻 Phantom / 지갑 연결',
    walletModuleFail: '❌ 지갑 모듈을 불러오지 못했습니다',
    walletFeeNote: '전송 금액 $',
    walletFeeNote2: ' USDT + 네트워크 수수료 ~$0.001',
    ddraAdding: '에 추가 중...',
    ddraAdded: '에 DDRA 추가 완료!',
    ddraAddedMsg: '에 DDRA 토큰이 추가되었습니다!',
    ddraBtnAdd: '내 지갑에 DDRA 추가',
    ddraCanceled: '취소되었습니다',
    ddraAddFail: '토큰 추가 실패',
    ddraError: '❌ 오류: ',
    ddraNoWalletTitle: '🔗 지갑 연결 필요',
    ddraNoWalletDesc: 'DDRA 토큰을 추가하려면 지원하는 지갑이 필요합니다',
    ddraInstall: '설치 →',
    ddraClose: '닫기',
    ddraManualTitle: '🪙 DDRA 토큰 수동 추가',
    ddraManualDesc: '아래 주소를 지갑에 직접 입력해 DDRA를 추가하세요',
    ddraSolLabel: 'SPL 토큰 민트 주소',
    ddraBscLabel: 'BEP-20 컨트랙트 주소',
    ddraCopy: '복사',
    ddraCopied: '✅ 복사됨',
    ddraAdminPending: '관리자 설정 대기 중',
    loginFail: '로그인 실패',
    loginError: '로그인 중 오류가 발생했습니다.',
    registerEnterName: '이름을 입력해주세요.',
    registerEnterPhone: '전화번호를 입력해주세요.',
    registerEnterEmail: '이메일을 입력해주세요.',
    registerEnterPw: '비밀번호를 입력해주세요.',
    registerPwMin: '비밀번호는 6자리 이상(영문/숫자 조합 권장)이어야 합니다.',
    registerSelectCountry: '국가를 선택해주세요.',
    registerRefRequired: '추천인 코드는 필수입니다.',
    registerInvalidRef: '유효하지 않은 추천인 코드입니다.',
    registerDone: '회원가입 완료! 환영합니다 🎉',
    forgotEmailFirst: '이메일을 먼저 입력하세요.',
    forgotEmailSent: '비밀번호 재설정 이메일을 발송했습니다.',
    loginIdPwRequired: '아이디와 비밀번호를 입력하세요.',
    initFail: '초기화 실패. 다시 시도해주세요.',
    // 추가 다국어 키
    langChanged: '언어가 변경되었습니다',
    walletAddrNotSet: '주소 미설정 (관리자 문의)',
    noGameDdra: '게임용 DDRA가 부족합니다.',
    coinFlying: '동전이 날아갑니다...',
    result: '결과',
    diceHit: '적중!',
    diceMiss: '빗나감',
    diceResult: '나온 숫자',
    jackpot: '잭팟!',
    slotMiss: '꽝!',
    spinAgain: '다시 스핀!',
    number: '숫자',
    rlRed2: '레드',
    rlBlack2: '블랙',
    rlZero2: '제로',
    rlOdd2: '홀수',
    rlEven2: '짝수',
    rlLow2: '1~18',
    rlHigh2: '19~36',
    bacPlayerWin: '플레이어 승리',
    bacBankerWin: '뱅커 승리',
    bacTie: '타이',
    bacTiePush: '타이 - 푸쉬 (베팅 반환)',
    bacPlayerWinBankerLose: '플레이어 승, 뱅커 베팅 패배',
    bacBankerWinPlayerLose: '뱅커 승, 플레이어 베팅 패배',
    bacPlayer: '플레이어',
    bacBanker: '뱅커',
    pkRoyal: '로열 플러시',
    pkStraightFlush: '스트레이트 플러시',
    pkFour: '포카드',
    pkFullHouse: '풀 하우스',
    pkFlush: '플러시',
    pkStraight: '스트레이트',
    pkThree: '쓰리 카드',
    pkTwoPair: '투 페어',
    pkOnePair: '원 페어',
    pkHighCard: '하이카드',
    pkDeal: '딜 (카드 받기)',
    pkDealing: '딜링...',
    pkReDeal: '다시 딜!',
    pkDealerNoQual: '딜러 퀄리파이 실패! 앤티 반환',
    pkDealer: '딜러',
    pkMyHand: '내 패',
    pkDealerWin: '딜러 승',
    pkTie: '동점 - 타이! 베팅 반환',
    emptyFreezePlan: 'FREEZE 플랜이 없습니다',
    emptyActiveFreeze: '진행 중인 FREEZE가 없습니다',
    periodLabel: '기간',
    minLabel: '최소',
    maxLabel: '최대',
    productHint3: 'FREEZE 시 일 수익',
    approx: '≈',
    principalUnfreeze: '원금은 만기 후 언프리즈 가능합니다.',
    ddraEquiv: 'DDRA 환산',
    expiryDate: '만기일',
    investTotalReturn: '총 예상수익(일)',
    simTotal: '합계',
    condNotSet: '조건 미설정',
    topRankAchieved: '최고 직급 달성! 🏆',
    emptyRefs: '추천인이 없습니다',
    shareToExpand: '추천 링크를 공유하여 네트워크를 확장해보세요!',
    me: '나',
    member: '회원',
    joinedOn: '가입',
    referralCodeLabel: '추천 코드',
    noName: '이름 없음',
    emptyTickets: '문의 내역이 없습니다',
    ticketClosed: '답변 완료',
    ticketProcessing: '처리 중',
    registering: '등록 중...',
    emptyNotifs: '알림이 없습니다',
    saving: '저장 중...',
    withdrawFee: '수수료',
    toastWithdrawDone2: '출금 신청 완료!',
    bonusRoiIncome2: '💎 ROI 수익',
    bonusDirectBonus2: '👤 추천 매칭',
    bonusCenterFee: '🏢 센터피',
    bonusManual: '🎁 수동 지급',
    other: '기타',
    memberCount: '명',
    memberCount2: '인원',
    genLabel: '대',
    downline: '산하',
    downline2: '하부',
    downlineOrg: '하부',
    todayEarning: '당일 내 수익',
    totalSales: '총 매출',
    salesLabel: '매출',
    deepGenMembers: '3대+ 인원',
    genSummary: '📊 대별 집계 (3대 이하는 개인정보 보호)',
    emptyGen: '하부 멤버가 없습니다',
    emptyDeepGen: '3대 이하 하부 멤버가 없습니다',
    needMore: '산하',
    moreNeeded: '더 필요',
    condMet: '인원 조건 달성!',
    freezeCondMet: 'FREEZE 조건 달성!',
    noCond: '조건 없음',
    needed: '필요',
    membersLabel: '인원',
    authInvalidEmail: '유효하지 않은 이메일입니다.',
    authUserNotFound: '등록되지 않은 이메일입니다.',
    authWrongPw: '비밀번호가 올바르지 않습니다.',
    authEmailUsed: '이미 사용 중인 이메일입니다.',
    authWeakPw: '비밀번호가 약합니다. 6자리 이상 영문/숫자 조합을 권장합니다.',
    authInvalidCred: '이메일 또는 비밀번호가 올바르지 않습니다.',
    authTooMany: '너무 많은 시도가 있었습니다. 잠시 후 다시 시도하세요.',
    authNetworkFail: '네트워크 오류가 발생했습니다.',
    authDisabled: '비활성화된 계정입니다. 관리자에게 문의하세요.',
    authError: '오류가 발생했습니다: ',
    txTypeDeposit: 'USDT 입금',
    txTypeWithdraw: '출금 (USDT)',
    txTypeBonus: '보너스 지급',
    txTypeInvest: 'FREEZE 신청',
    txTypeGame: '게임',
    txTypeReferral: '추천',
    pwaTitle: 'DEEDRA 앱 설치',
    pwaDesc: '홈 화면에 추가하면 더 빠르게 실행돼요',
    pwaBtn: '설치',
    pwaInstalled: '✅ DEEDRA 앱이 설치되었습니다!',
    referralConfirmed: '추천인',
    confirmed: '확인됨',
    // 홈화면 하드코딩 → 번역키 추가
    ddraLivePrice: '💎 DDRA 현재 시세',
    earnSeeAll: '전체보기 ›',
    freezingNow: 'FREEZE 중',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: '출금 가능 DDRA',
    globalNetworkMap: '🌍 글로벌 라이브 네트워크',
    networkEarnings: '🌐 네트워크 수익',
    networkDetail: '자세히 보기',
    todayEarn: '당일 수익',
    subMembers: '하부 인원',
    totalEarnings: '누적 수익',
    membersUnit: '명',
    recentGameLog: '📋 최근 게임 기록',
    withdrawableDdraLabel: '출금 가능 DDRA (수익)',
    networkPanelTitle: '🌐 네트워크 수익',
    panelTodayEarn: '당일 수익',
    panelTotalEarn: '총 누적 수익',
  },
  en: {
    errWithdrawTime: 'Withdrawal is not available at this time.\nAvailable from {day} {time}.',
    errWithdrawTimeToday: 'Withdrawal is not available at this time.\nAvailable today from {time}.',
    errWithdrawRestricted: 'Withdrawals are currently restricted.',
    dayTomorrow: 'Tomorrow',
    dayDayAfter: 'The day after tomorrow',
    dayNextWeek: 'Next {day}',
    daySun: 'Sunday', dayMon: 'Monday', dayTue: 'Tuesday', dayWed: 'Wednesday', dayThu: 'Thursday', dayFri: 'Friday', daySat: 'Saturday',
    
    upbitRealTime: 'Upbit Live',
    loadingPrice: 'Loading prices...',
    coin_BTC: 'Bitcoin',
    coin_ETH: 'Ethereum',
    coin_SOL: 'Solana',
    coin_XRP: 'Ripple',
    coin_DOGE: 'Dogecoin',
    coin_SHIB: 'Shiba Inu',
    coin_ADA: 'Cardano',
    coin_AVAX: 'Avalanche',
    noSubMembers: 'No downline members.',
    orgDepthLimitTitle: 'Organization Chart Access Restricted',
    orgDepthLimitDesc: 'Your current <strong>{rank}</strong> rank can only view up to <strong>level {depth}</strong>.<br>Upgrade your rank to see deeper into your network! 🚀',

    diceHint: 'Select a number to bet',
    earnSeeAll: 'See All Earnings',
    freezingNow: '❄️ Freezing',
    gameStartHint: 'Select chips to bet',
    labelCountry: 'Country',
    netPerfAll: 'Total Org Perf.',
    netPerfGen1: 'Gen1 Perf.',
    netPerfGen2: 'Gen2 Perf.',
    networkDetail: 'Network Detail',
    networkEarnings: 'Network Earnings',
    playWithEarn: 'Play with Earnings',
    rank_next_label: 'Next Rank:',
    rank_referral: 'Referrals',
    rank_referral_unit: ' members',
    subMembers: 'Sub Members',
    todayEarn: 'Today Earn',
    todayEarnLabel: 'Today Earn',
    todayEarnSummary: 'TODAY Earnings Summary',
    totalEarnSum: 'Total Earnings Sum',
    totalEarnings: 'Total Earnings',
    totalSubMembersEarn: 'Total Sub Members & Earn',
    viewDetail: 'Details ›',
    withdrawNoticeText: '※ 1-3 days for processing',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: 'Withdrawable DDRA',
    withdrawableDdraLabel: 'Withdrawable DDRA',
    tabGen1: 'Gen 1',
    tabGen2: 'Gen 2',
    tabDeep: 'Deep Org',
    tabTx: 'Transactions',
    emptySubGen: 'No sub-members in Gen {gen}',
    emptyDeepGen: 'No sub-members in Gen 3+',
    genSub: 'Gen {gen}',
    orgTitle: 'Org Perf. ({n} members)',
    myInvestTitle: '📋 My FREEZE',
    emptyInvest: 'No active FREEZE found',
    dailyReturnLabel: '❄️ Daily Return:',
    remainDaysLabel: '{n} days left',
    totalExpectedLabel: 'Total Expected/Day: +{n} USDT (Principal withdrawable at maturity)',
    investUnit: ' items',
    perDay: '/day',
    productMonth1: '1 Month',
    productMonth3: '3 Months',
    productMonth6: '6 Months',
    productMonth12: '12 Months',
    productHint1: 'Daily return for {min} USDT FREEZE',
    productHint2: 'Principal unlockable after maturity',
    ddraConvert: 'DDRA Conv.',
    maturityDate: 'Maturity Date',
    emptyNotice: 'No announcements',
    loadFail: 'Failed to load',
        emptyTx: 'No transaction history',
    chatTabGroup: 'My Group',
    chatTabUpline: 'Sponsor',
    chatNoSponsor: 'No sponsor available.',
    chatFirstMessage: 'Send your first message!',
    chatInputPlaceholder: 'Type a message...',
    chatSendFail: 'Failed to send message',
    chatNewMessage: 'New message arrived.',
    chatPageTitle: 'Chat',
    fee: 'Fee',
    globalNetwork: 'Real-time Global Network',
    majorCryptoPrice: 'Major Crypto Live Price',
    majorCryptoPrice: '주요 암호화폐 실시간 시세',
    newsViewerTitle: '📰 View News',
    tickerJoined: 'New user joined in {city}',
    tickerDeposited: '{amt} USDT Deposited from {city}',
    tickerUpgraded: 'Rank upgraded in {city}',
    tickerFreeze: '{amt} USDT FREEZE in {city}',
    emptyBonus: 'No earnings history',
    emptyBonusSub: 'Will be displayed here when admin runs daily settlement.',
    emptyProducts: 'No FREEZE plans available',
    emptyNoti: 'No notifications',
    emptyTicket: 'No support tickets',
    emptyRef: 'No referrals',
    notiTitleMature: '✅ FREEZE Matured',
    notiMsgMature: '[{name}] FREEZE contract has matured. Principal {amt} USDT has been unfrozen to your wallet.',
    toastMature: '❄️ {n} matured FREEZE principals have been unfrozen.',
  
    authTagline: '🔐 Safe and Smart Crypto FREEZE',
    loginTab: 'Login',
    registerTab: 'Register',
    labelUsername: 'Username',
    labelUsername: 'ID',
    labelEmail: 'Email',
    labelPassword: 'Password',
    placeholderUsername: 'Enter your username',
    placeholderEmail: 'Enter your email',
    placeholderPassword: 'Enter your password',
    placeholderPasswordMin: 'At least 4 characters',
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
    btnWithdraw: 'Withdraw (USDT)',
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
    activeInvest: 'Active FREEZE',
    totalInvest: 'Total FREEZE',
    expectedReturnLabel: 'Expected Return',
    simTitle: '❄️ FREEZE Simulator',
    simSelectProduct: 'Select Product',
    simUsdtAmount: 'USDT Amount',
    simInvestAmount: 'FREEZE Amount',
    simPeriod: 'Period',
    simRoi: 'ROI',
    simEarning: 'Earnings (USDT)',
    simEarningUsd: 'Total Earnings (USDT)',
    productListTitle: '❄️ FREEZE Plans',
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
    betOddBtn: 'Odd',
    betEvenBtn: 'Even',
    newsTitle: '📰 News',
    refresh: 'Refresh',
    peopleUnit: ' users',
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
    depositAddrLabel: 'Company Wallet Address (Solana SPL)',
    depositAddrLoading: 'Loading address...',
    depositAmountLabel: 'Deposit Amount (USDT)',
    depositTxidLabel: 'TXID (Transaction Hash)',
    depositTxidPlaceholder: 'Enter transaction hash',
    depositMemoLabel: 'Memo (Optional)',
    depositMemoPlaceholder: 'Enter memo (optional)',
    depositWarning: '⚠️ Please deposit to the address above and enter the TXID. Balance will be updated after admin approval.',
    btnCancel: 'Cancel',
    btnSubmitDeposit: 'Submit Deposit',
    modalWithdraw: '💸 USDT Withdrawal Request',
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
    toastPwMin: 'Password must be at least 4 characters.',
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
    cancel: 'Cancel',
    confirm: 'OK',
    failPrefix: 'Failed: ',
    saveFail: 'Save failed: ',
    regFail: 'Registration failed: ',
    days: ' days',
    units: '',
    emptyProducts: 'No products',
    emptyAnnounce: 'No announcements',
    emptyTx: 'No transactions',
    emptyBonus: 'No earnings yet',
    emptyBonusSub: 'Earnings will appear here after admin runs daily settlement.',
    emptyNotice: 'Announcement not found.',
    loadFail: 'Failed to load',
    loading: 'Loading...',
    noTitle: 'Untitled',
    noContent: 'No content',
    pinBadge: 'Notice',
    statusPending: 'Pending',
    statusApproved: 'Completed',
    statusRejected: 'Rejected',
    greetingDawn: 'Working hard early! 🌙',
    greetingMorning: 'Good morning ☀️',
    greetingAfternoon: 'Hello 👋',
    greetingEvening: 'Good evening 🌆',
    freezeOngoing: 'FREEZE in progress',
    daysRemain: ' days left',
    dailyRoi: 'Daily ROI',
    perioDays: 'd',
    minAmount: 'Min $',
    bonusRoiIncome: '❄️ FREEZE ROI',
    bonusDirectBonus: '👥 Direct Bonus',
    bonusUnilevelBonus: '🌐 Unilevel Bonus',
    bonusRankBonus: '🏆 Rank Bonus',
    bonusDefault: 'Bonus',
    bonusSettleDate: 'Settlement: ',
    bonusLevel: ' level',
    bonusBaseIncome: 'Base: $',
    bonusCompleted: 'Completed',
    winText: 'Win',
    loseText: 'Lose',
    priceUpdated: 'Updated: ',
    walletConnecting: 'Connecting...',
    walletInquiring: 'Checking...',
    walletConnected: 'Connected',
    walletNoWallet: '❌ No wallet detected.\nPlease install Phantom or TokenPocket.',
    walletCancelConnect: 'Connection cancelled.',
    walletMovingApp: 'Opening app...',
    walletConnectFirst: 'Please connect your wallet first.',
    walletMinDeposit: 'Minimum deposit is $1 USDT.',
    walletNoCompanyAddr: '❌ Company wallet address is not configured.',
    walletProcessing: '⏳ Processing...',
    walletSigning: '🔐 Requesting wallet signature... (check wallet popup)',
    walletVerifying: '📡 Verifying on-chain... (up to 30 seconds)',
    walletDepositComplete: '✅ Deposit complete! Balance updated automatically.',
    walletDepositPending: '⏳ Transfer complete! Awaiting admin approval.',
    walletTransferDone: 'Transfer complete! Awaiting admin approval.',
    walletCancelSign: 'Signature cancelled.',
    walletDisconnected: 'Wallet disconnected. Please reconnect.',
    walletInsufficientSol: '❌ Insufficient USDT or SOL balance.',
    walletInsufficientSolMsg: '❌ Insufficient balance (check USDT or SOL for fees)',
    walletTransferFail: 'Transfer failed',
    walletBtnSend: '🚀 Send via Wallet',
    walletBtnConnect: '👻 Phantom / Connect Wallet',
    walletModuleFail: '❌ Failed to load wallet module',
    walletFeeNote: 'Send amount $',
    walletFeeNote2: ' USDT + network fee ~$0.001',
    ddraAdding: ' adding...',
    ddraAdded: ' DDRA added!',
    ddraAddedMsg: ' DDRA token has been added!',
    ddraBtnAdd: 'Add DDRA to Wallet',
    ddraCanceled: 'Cancelled',
    ddraAddFail: 'Token add failed',
    ddraError: '❌ Error: ',
    ddraNoWalletTitle: '🔗 Wallet Required',
    ddraNoWalletDesc: 'You need a supported wallet to add DDRA tokens',
    ddraInstall: 'Install →',
    ddraClose: 'Close',
    ddraManualTitle: '🪙 Add DDRA Token Manually',
    ddraManualDesc: 'Enter the address below directly into your wallet',
    ddraSolLabel: 'SPL Token Mint Address',
    ddraBscLabel: 'BEP-20 Contract Address',
    ddraCopy: 'Copy',
    ddraCopied: '✅ Copied',
    ddraAdminPending: 'Admin setup pending',
    loginFail: 'Login failed',
    loginError: 'An error occurred during login.',
    registerEnterName: 'Please enter your name.',
    registerEnterPhone: 'Please enter your phone number.',
    registerEnterEmail: 'Please enter your email.',
    registerEnterPw: 'Please enter your password.',
    registerPwMin: 'Password must be at least 6 characters.',
    registerSelectCountry: 'Please select your country.',
    registerRefRequired: 'Referral code is required.',
    registerInvalidRef: 'Invalid referral code.',
    registerDone: 'Registration complete! Welcome 🎉',
    forgotEmailFirst: 'Please enter your email first.',
    forgotEmailSent: 'Password reset email sent.',
    loginIdPwRequired: 'Please enter your ID and password.',
    initFail: 'Initialization failed. Please try again.',
    langChanged: 'Language changed',
    walletAddrNotSet: 'Address not set (contact admin)',
    noGameDdra: 'No game DDRA. Earn from FREEZE to play.',
    coinFlying: 'Coin is flying...',
    result: 'Result',
    diceHit: 'Hit!',
    diceMiss: 'Miss',
    diceResult: 'Number rolled',
    jackpot: 'Jackpot!',
    slotMiss: 'No win!',
    spinAgain: 'Spin Again!',
    number: 'Number',
    rlRed2: 'Red',
    rlBlack2: 'Black',
    rlZero2: 'Zero',
    rlOdd2: 'Odd',
    rlEven2: 'Even',
    rlLow2: '1~18',
    rlHigh2: '19~36',
    bacPlayerWin: 'Player Win',
    bacBankerWin: 'Banker Win',
    bacTie: 'Tie',
    bacTiePush: 'Tie - Push (bet returned)',
    bacPlayerWinBankerLose: 'Player Win, Banker Bet Lost',
    bacBankerWinPlayerLose: 'Banker Win, Player Bet Lost',
    bacPlayer: 'Player',
    bacBanker: 'Banker',
    pkRoyal: 'Royal Flush',
    pkStraightFlush: 'Straight Flush',
    pkFour: 'Four of a Kind',
    pkFullHouse: 'Full House',
    pkFlush: 'Flush',
    pkStraight: 'Straight',
    pkThree: 'Three of a Kind',
    pkTwoPair: 'Two Pair',
    pkOnePair: 'One Pair',
    pkHighCard: 'High Card',
    pkDeal: 'Deal (Get Cards)',
    pkDealing: 'Dealing...',
    pkReDeal: 'Deal Again!',
    pkDealerNoQual: 'Dealer No Qualify! Ante returned',
    pkDealer: 'Dealer',
    pkMyHand: 'My Hand',
    pkDealerWin: 'Dealer Win',
    pkTie: 'Tie! Bet returned',
    emptyFreezePlan: 'No FREEZE Plans',
    emptyActiveFreeze: 'No active FREEZE',
    periodLabel: 'Period',
    minLabel: 'Min',
    maxLabel: 'Max',
    productHint3: 'FREEZE daily earnings',
    approx: '≈',
    principalUnfreeze: 'Principal can be unfrozen after maturity.',
    ddraEquiv: 'DDRA equivalent',
    expiryDate: 'Expiry Date',
    investTotalReturn: 'Total Expected Return (daily)',
    simTotal: 'total',
    condNotSet: 'No condition set',
    topRankAchieved: 'Top rank achieved! 🏆',
    emptyRefs: 'No referrals',
    shareToExpand: 'Share referral link to grow your network!',
    me: 'Me',
    member: 'Member',
    joinedOn: 'Joined',
    referralCodeLabel: 'Referral Code',
    noName: 'No name',
    emptyTickets: 'No support tickets',
    ticketClosed: 'Answered',
    ticketProcessing: 'Processing',
    registering: 'Submitting...',
    emptyNotifs: 'No notifications',
    saving: 'Saving...',
    withdrawFee: 'Fee',
    toastWithdrawDone2: 'Withdrawal submitted!',
    bonusRoiIncome2: '💎 ROI Income',
    bonusDirectBonus2: '👤 Direct Bonus',
    bonusCenterFee: '🏢 Center Fee',
    bonusManual: '🎁 Manual Bonus',
    other: 'Other',
    memberCount: '',
    memberCount2: 'Members',
    genLabel: 'gen',
    downline: 'Downline',
    downline2: 'downline',
    downlineOrg: 'Downline',
    todayEarning: "Today's Earnings",
    totalSales: 'Total Sales',
    salesLabel: 'Sales',
    deepGenMembers: 'Gen3+ Members',
    genSummary: '📊 Generation Summary (Gen3+ privacy protected)',
    emptyGen: 'No downline members',
    emptyDeepGen: 'No gen3+ downline members',
    needMore: 'Need more',
    moreNeeded: 'more needed',
    condMet: 'Member condition met!',
    freezeCondMet: 'FREEZE condition met!',
    noCond: 'No condition',
    needed: 'needed',
    membersLabel: 'Members',
    authInvalidEmail: 'Invalid email address.',
    authUserNotFound: 'Email not registered.',
    authWrongPw: 'Incorrect password.',
    authEmailUsed: 'Email already in use.',
    authWeakPw: 'Password too weak. Please use at least 6 alphanumeric characters.',
    authInvalidCred: 'Invalid email or password.',
    authTooMany: 'Too many attempts. Please try again later.',
    authNetworkFail: 'Network error occurred.',
    authDisabled: 'Account disabled. Contact admin.',
    authError: 'Error occurred: ',
    txTypeDeposit: 'USDT Deposit',
    txTypeWithdraw: 'Withdrawal (USDT)',
    txTypeBonus: 'Bonus',
    txTypeInvest: 'FREEZE',
    txTypeGame: 'Game',
    txTypeReferral: 'Referral',
    pwaTitle: 'Install DEEDRA App',
    pwaDesc: 'Add to home screen for faster access',
    pwaBtn: 'Install',
    pwaInstalled: '✅ DEEDRA App installed!',
    referralConfirmed: 'Referral',
    confirmed: 'Confirmed',
    ddraLivePrice: '💎 DDRA Live Price',
    earnSeeAll: 'View All ›',
    freezingNow: 'Freezing',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: 'Withdrawable DDRA',
    networkEarnings: '🌐 Network Earnings',
    networkDetail: 'View Details',
    todayEarn: 'Today Earnings',
    subMembers: 'Sub Members',
    totalEarnings: 'Total Earnings',
    membersUnit: '',
    recentGameLog: '📋 Recent Game History',
    withdrawableDdraLabel: 'Withdrawable DDRA (Earnings)',
    networkPanelTitle: '🌐 Network Earnings',
    panelTodayEarn: "Today's Earnings",
    panelTotalEarn: 'Total Earnings',
  },
  vi: {
    errWithdrawTime: 'Hiện không phải là thời gian rút tiền.\nCó thể rút từ {day} {time}.',
    errWithdrawTimeToday: 'Hiện không phải là thời gian rút tiền.\nCó thể rút hôm nay từ {time}.',
    errWithdrawRestricted: 'Rút tiền hiện đang bị hạn chế.',
    dayTomorrow: 'Ngày mai',
    dayDayAfter: 'Ngày kia',
    dayNextWeek: 'Thứ {day} tuần sau',
    daySun: 'Chủ nhật', dayMon: 'Hai', dayTue: 'Ba', dayWed: 'Tư', dayThu: 'Năm', dayFri: 'Sáu', daySat: 'Bảy',
    
    majorCryptoPrice: 'Giá Tiền Điện Tử Chính',
    upbitRealTime: 'Upbit Trực tiếp',
    loadingPrice: 'Đang tải giá...',
    coin_BTC: 'Bitcoin',
    coin_ETH: 'Ethereum',
    coin_SOL: 'Solana',
    coin_XRP: 'Ripple',
    coin_DOGE: 'Dogecoin',
    coin_SHIB: 'Shiba Inu',
    coin_ADA: 'Cardano',
    coin_AVAX: 'Avalanche',
    noSubMembers: 'Không có thành viên tuyến dưới.',
    orgDepthLimitTitle: 'Hạn chế quyền xem sơ đồ tổ chức',
    orgDepthLimitDesc: 'Cấp bậc <strong>{rank}</strong> hiện tại của bạn chỉ có thể xem tối đa <strong>thế hệ {depth}</strong>.<br>Hãy thăng cấp để xem sâu hơn vào mạng lưới của bạn! 🚀',

    diceHint: 'Chọn một số để cược',
    earnSeeAll: 'Xem tất cả',
    freezingNow: '❄️ Đang đóng băng',
    gameStartHint: 'Chọn chip để cược',
    labelCountry: 'Quốc gia',
    netPerfAll: 'Thành tích toàn bộ',
    netPerfGen1: 'Thành tích F1',
    netPerfGen2: 'Thành tích F2',
    networkDetail: 'Chi tiết mạng lưới',
    networkEarnings: 'Thu nhập mạng lưới',
    playWithEarn: 'Chơi bằng Thu nhập',
    rank_next_label: 'Hạng tiếp theo:',
    rank_referral: 'Giới thiệu',
    rank_referral_unit: ' TV',
    subMembers: 'TV cấp dưới',
    todayEarn: 'Thu nhập HN',
    todayEarnLabel: 'Thu nhập Hôm nay',
    todayEarnSummary: 'Tóm tắt thu nhập HÔM NAY',
    totalEarnSum: 'Tổng thu nhập',
    totalEarnings: 'Tổng thu nhập',
    totalSubMembersEarn: 'Tổng TV & Thu nhập',
    viewDetail: 'Chi tiết ›',
    withdrawNoticeText: '※ Xử lý trong 1-3 ngày',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: 'DDRA có thể rút',
    withdrawableDdraLabel: 'DDRA có thể rút',
    tabGen1: 'Thế hệ 1',
    tabGen2: 'Thế hệ 2',
    tabDeep: 'Mạng lưới',
    tabTx: 'Giao dịch',
    emptySubGen: 'Không có thành viên ở F{gen}',
    emptyDeepGen: 'Không có thành viên ở F3+',
    genSub: 'F{gen}',
    orgTitle: 'Thành tích lưới ({n} TV)',
    myInvestTitle: '📋 Đầu tư của tôi',
    emptyInvest: 'Không có FREEZE nào đang hoạt động',
    dailyReturnLabel: '❄️ Lợi nhuận hàng ngày:',
    remainDaysLabel: 'Còn lại {n} ngày',
    totalExpectedLabel: 'Tổng dự kiến/ngày: +{n} USDT (Gốc có thể rút khi đáo hạn)',
    investUnit: ' mục',
    perDay: '/ngày',
    productMonth1: '1 Tháng',
    productMonth3: '3 Tháng',
    productMonth6: '6 Tháng',
    productMonth12: '12 Tháng',
    productHint1: 'Lợi nhuận hàng ngày với {min} USDT FREEZE',
    productHint2: 'Gốc có thể rút sau khi đáo hạn',
    ddraConvert: 'Quy đổi DDRA',
    maturityDate: 'Ngày đáo hạn',
    emptyNotice: 'Không có thông báo',
    loadFail: 'Tải thất bại',
        emptyTx: 'Không có lịch sử giao dịch',
    chatTabGroup: 'Nhóm của tôi',
    chatTabUpline: 'Nhà tài trợ',
    chatNoSponsor: 'Không có nhà tài trợ.',
    chatFirstMessage: 'Gửi tin nhắn đầu tiên của bạn!',
    chatInputPlaceholder: 'Nhập tin nhắn...',
    chatSendFail: 'Gửi tin nhắn thất bại',
    chatNewMessage: 'Tin nhắn mới đã đến.',
    chatPageTitle: 'Trò chuyện',
    fee: 'Phí',
    globalNetwork: 'Mạng lưới toàn cầu',
    majorCryptoPrice: 'Major Crypto Live Price',
    majorCryptoPrice: '주요 암호화폐 실시간 시세',
    newsViewerTitle: '📰 Xem Tin tức',
    tickerJoined: 'Người dùng mới đã tham gia từ {city}',
    tickerDeposited: '{amt} USDT đã được nạp từ {city}',
    tickerUpgraded: 'Thăng cấp hạng từ {city}',
    tickerFreeze: '{amt} USDT FREEZE từ {city}',
    emptyBonus: 'Không có lịch sử thu nhập',
    emptyBonusSub: 'Sẽ hiển thị ở đây khi admin chạy quyết toán hàng ngày.',
    emptyProducts: 'Không có gói FREEZE',
    emptyNoti: 'Không có thông báo',
    emptyTicket: 'Không có phiếu hỗ trợ',
    emptyRef: 'Không có người giới thiệu',
    notiTitleMature: '✅ FREEZE Đáo hạn',
    notiMsgMature: '[{name}] Hợp đồng FREEZE đã đáo hạn. Gốc {amt} USDT đã được hoàn lại vào ví.',
    toastMature: '❄️ {n} khoản gốc FREEZE đáo hạn đã được hoàn lại.',
  
    authTagline: '🔐 FREEZE tài sản số an toàn & thông minh',
    loginTab: 'Đăng nhập',
    registerTab: 'Đăng ký',
    labelUsername: 'ID',
    labelEmail: 'Email',
    labelPassword: 'Mật khẩu',
    placeholderEmail: 'Nhập email của bạn',
    placeholderPassword: 'Nhập mật khẩu',
    placeholderPasswordMin: 'Tối thiểu 4 ký tự',
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
    btnWithdraw: 'Rút tiền (USDT)',
    deedraPrice: 'Giá DDRA hiện tại',
    recentUpdated: 'Cập nhật: ',
    investingNow: '❄️ FREEZE đang hoạt động',
    investAmount: 'FREEZE',
    expectedReturn: 'Lợi nhuận dự kiến',
    remaining: 'Còn lại',
    announcements: '📢 Thông báo',
    seeAll: 'Xem tất cả',
    recentTx: '💳 Giao dịch gần đây',
    pageInvest: '📈 Đầu tư',
    activeInvest: 'Đang FREEZE',
    totalInvest: 'Tổng FREEZE',
    expectedReturnLabel: 'Lợi nhuận dự kiến',
    simTitle: 'Máy tính lợi nhuận',
    simSelectProduct: 'Chọn sản phẩm',
    simUsdtAmount: 'Số tiền USDT',
    simInvestAmount: 'Số tiền đầu tư',
    simPeriod: 'Thời gian',
    simRoi: 'ROI',
    simEarning: 'Thu nhập (USDT)',
    simEarningUsd: 'Thu nhập tổng cộng (USDT)',
    productListTitle: '❄️ FREEZE Plans',
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
    betOddBtn: 'Lẻ (Odd)',
    betEvenBtn: 'Chẵn (Even)',
    newsTitle: '📰 Tin tức',
    refresh: 'Làm mới',
    peopleUnit: ' người',
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
    depositAddrLabel: 'Địa chỉ ví công ty (Solana SPL)',
    depositAddrLoading: 'Đang tải địa chỉ...',
    depositAmountLabel: 'Số tiền nạp (USDT)',
    depositTxidLabel: 'TXID (Mã giao dịch)',
    depositTxidPlaceholder: 'Nhập mã giao dịch',
    depositMemoLabel: 'Ghi chú (Tùy chọn)',
    depositMemoPlaceholder: 'Nhập ghi chú (tùy chọn)',
    depositWarning: '⚠️ Vui lòng nạp vào địa chỉ trên và nhập TXID. Số dư sẽ được cập nhật sau khi admin duyệt.',
    btnCancel: 'Hủy',
    btnSubmitDeposit: 'Gửi yêu cầu',
    modalWithdraw: '💸 Yêu cầu rút tiền (USDT)',
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
    toastPwMin: 'Mật khẩu phải ít nhất 4 ký tự.',
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
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    failPrefix: 'Thất bại: ',
    saveFail: 'Lưu thất bại: ',
    regFail: 'Đăng ký thất bại: ',
    days: ' ngày',
    units: '',
    emptyProducts: 'Không có sản phẩm',
    emptyAnnounce: 'Không có thông báo',
    emptyTx: 'Không có giao dịch',
    emptyBonus: 'Chưa có thu nhập',
    emptyBonusSub: 'Thu nhập sẽ hiển thị sau khi admin chạy thanh toán hàng ngày.',
    emptyNotice: 'Không tìm thấy thông báo.',
    loadFail: 'Tải thất bại',
    loading: 'Đang tải...',
    noTitle: 'Không có tiêu đề',
    noContent: 'Không có nội dung',
    pinBadge: 'Thông báo',
    statusPending: 'Chờ duyệt',
    statusApproved: 'Hoàn thành',
    statusRejected: 'Bị từ chối',
    greetingDawn: 'Chăm chỉ lắm! 🌙',
    greetingMorning: 'Chào buổi sáng ☀️',
    greetingAfternoon: 'Xin chào 👋',
    greetingEvening: 'Chào buổi tối 🌆',
    freezeOngoing: 'FREEZE đang chạy',
    daysRemain: ' ngày còn lại',
    dailyRoi: 'ROI hàng ngày',
    perioDays: 'ng',
    minAmount: 'Tối thiểu $',
    bonusRoiIncome: '❄️ FREEZE ROI',
    bonusDirectBonus: '👥 Thưởng trực tiếp',
    bonusUnilevelBonus: '🌐 Thưởng Unilevel',
    bonusRankBonus: '🏆 Thưởng hạng',
    bonusDefault: 'Thưởng',
    bonusSettleDate: 'Ngày thanh toán: ',
    bonusLevel: ' cấp',
    bonusBaseIncome: 'Cơ sở: $',
    bonusCompleted: 'Hoàn thành',
    winText: 'Thắng',
    loseText: 'Thua',
    priceUpdated: 'Cập nhật: ',
    walletConnecting: 'Đang kết nối...',
    walletInquiring: 'Đang kiểm tra...',
    walletConnected: 'Đã kết nối',
    walletNoWallet: '❌ Không phát hiện ví.\nVui lòng cài Phantom hoặc TokenPocket.',
    walletCancelConnect: 'Đã hủy kết nối.',
    walletMovingApp: 'Đang mở ứng dụng...',
    walletConnectFirst: 'Vui lòng kết nối ví trước.',
    walletMinDeposit: 'Nạp tối thiểu $1 USDT.',
    walletNoCompanyAddr: '❌ Địa chỉ ví công ty chưa được cấu hình.',
    walletProcessing: '⏳ Đang xử lý...',
    walletSigning: '🔐 Yêu cầu ký ví... (kiểm tra popup ví)',
    walletVerifying: '📡 Đang xác minh on-chain... (tối đa 30 giây)',
    walletDepositComplete: '✅ Nạp tiền hoàn tất! Số dư đã được cập nhật.',
    walletDepositPending: '⏳ Chuyển khoản xong! Chờ admin duyệt.',
    walletTransferDone: 'Chuyển khoản xong! Chờ admin duyệt.',
    walletCancelSign: 'Đã hủy ký.',
    walletDisconnected: 'Ví đã ngắt kết nối. Vui lòng kết nối lại.',
    walletInsufficientSol: '❌ Số dư USDT hoặc SOL không đủ.',
    walletInsufficientSolMsg: '❌ Số dư không đủ (kiểm tra USDT hoặc SOL cho phí)',
    walletTransferFail: 'Chuyển khoản thất bại',
    walletBtnSend: '🚀 Gửi qua ví',
    walletBtnConnect: '👻 Phantom / Kết nối ví',
    walletModuleFail: '❌ Không tải được module ví',
    walletFeeNote: 'Số tiền gửi $',
    walletFeeNote2: ' USDT + phí mạng ~$0.001',
    ddraAdding: ' đang thêm...',
    ddraAdded: ' DDRA đã thêm!',
    ddraAddedMsg: ' token DDRA đã được thêm!',
    ddraBtnAdd: 'Thêm DDRA vào ví',
    ddraCanceled: 'Đã hủy',
    ddraAddFail: 'Thêm token thất bại',
    ddraError: '❌ Lỗi: ',
    ddraNoWalletTitle: '🔗 Cần ví',
    ddraNoWalletDesc: 'Bạn cần ví được hỗ trợ để thêm token DDRA',
    ddraInstall: 'Cài đặt →',
    ddraClose: 'Đóng',
    ddraManualTitle: '🪙 Thêm DDRA thủ công',
    ddraManualDesc: 'Nhập địa chỉ bên dưới trực tiếp vào ví của bạn',
    ddraSolLabel: 'Địa chỉ SPL Token Mint',
    ddraBscLabel: 'Địa chỉ BEP-20 Contract',
    ddraCopy: 'Sao chép',
    ddraCopied: '✅ Đã sao chép',
    ddraAdminPending: 'Chờ admin cấu hình',
    loginFail: 'Đăng nhập thất bại',
    loginError: 'Đã xảy ra lỗi khi đăng nhập.',
    registerEnterName: 'Vui lòng nhập tên.',
    registerEnterPhone: 'Vui lòng nhập số điện thoại.',
    registerEnterEmail: 'Vui lòng nhập email.',
    registerEnterPw: 'Vui lòng nhập mật khẩu.',
    registerPwMin: 'Mật khẩu phải ít nhất 6 ký tự.',
    registerSelectCountry: 'Vui lòng chọn quốc gia.',
    registerRefRequired: 'Mã giới thiệu là bắt buộc.',
    registerInvalidRef: 'Mã giới thiệu không hợp lệ.',
    registerDone: 'Đăng ký thành công! Chào mừng 🎉',
    forgotEmailFirst: 'Vui lòng nhập email trước.',
    forgotEmailSent: 'Đã gửi email đặt lại mật khẩu.',
    loginIdPwRequired: 'Vui lòng nhập ID và mật khẩu.',
    initFail: 'Khởi tạo thất bại. Vui lòng thử lại.',
    langChanged: 'Đã thay đổi ngôn ngữ',
    walletAddrNotSet: 'Chưa cài địa chỉ (liên hệ admin)',
    noGameDdra: 'Không có DDRA. Kiếm từ FREEZE để chơi.',
    coinFlying: 'Đồng xu đang bay...',
    result: 'Kết quả',
    diceHit: 'Trúng!',
    diceMiss: 'Trượt',
    diceResult: 'Số xuất hiện',
    jackpot: 'Jackpot!',
    slotMiss: 'Không trúng!',
    spinAgain: 'Quay lại!',
    number: 'Số',
    rlRed2: 'Đỏ',
    rlBlack2: 'Đen',
    rlZero2: 'Zero',
    rlOdd2: 'Lẻ',
    rlEven2: 'Chẵn',
    rlLow2: '1~18',
    rlHigh2: '19~36',
    bacPlayerWin: 'Player Thắng',
    bacBankerWin: 'Banker Thắng',
    bacTie: 'Hòa',
    bacTiePush: 'Hòa - Push (hoàn cược)',
    bacPlayerWinBankerLose: 'Player thắng, cược Banker thua',
    bacBankerWinPlayerLose: 'Banker thắng, cược Player thua',
    bacPlayer: 'Player',
    bacBanker: 'Banker',
    pkRoyal: 'Royal Flush',
    pkStraightFlush: 'Straight Flush',
    pkFour: 'Tứ Quý',
    pkFullHouse: 'Full House',
    pkFlush: 'Flush',
    pkStraight: 'Straight',
    pkThree: 'Ba Lá',
    pkTwoPair: 'Hai Đôi',
    pkOnePair: 'Một Đôi',
    pkHighCard: 'Bài Cao',
    pkDeal: 'Chia Bài',
    pkDealing: 'Đang chia...',
    pkReDeal: 'Chia lại!',
    pkDealerNoQual: 'Dealer không đủ điều kiện! Hoàn ante',
    pkDealer: 'Dealer',
    pkMyHand: 'Bài của tôi',
    pkDealerWin: 'Dealer Thắng',
    pkTie: 'Hòa! Hoàn cược',
    emptyFreezePlan: 'Không có kế hoạch FREEZE',
    emptyActiveFreeze: 'Không có FREEZE đang hoạt động',
    periodLabel: 'Thời hạn',
    minLabel: 'Tối thiểu',
    maxLabel: 'Tối đa',
    productHint3: 'FREEZE thu nhập hàng ngày',
    approx: '≈',
    principalUnfreeze: 'Vốn có thể rút sau khi đáo hạn.',
    ddraEquiv: 'Quy đổi DDRA',
    expiryDate: 'Ngày đáo hạn',
    investTotalReturn: 'Tổng lợi nhuận kỳ vọng (ngày)',
    simTotal: 'tổng',
    condNotSet: 'Chưa đặt điều kiện',
    topRankAchieved: 'Đạt cấp cao nhất! 🏆',
    emptyRefs: 'Không có người giới thiệu',
    shareToExpand: 'Chia sẻ link giới thiệu để mở rộng mạng lưới!',
    me: 'Tôi',
    member: 'Thành viên',
    joinedOn: 'Tham gia',
    referralCodeLabel: 'Mã giới thiệu',
    noName: 'Không có tên',
    emptyTickets: 'Không có hỗ trợ',
    ticketClosed: 'Đã trả lời',
    ticketProcessing: 'Đang xử lý',
    registering: 'Đang gửi...',
    emptyNotifs: 'Không có thông báo',
    saving: 'Đang lưu...',
    withdrawFee: 'Phí',
    toastWithdrawDone2: 'Đã gửi yêu cầu rút tiền!',
    bonusRoiIncome2: '💎 Thu nhập ROI',
    bonusDirectBonus2: '👤 Thưởng trực tiếp',
    bonusCenterFee: '🏢 Phí trung tâm',
    bonusManual: '🎁 Thưởng thủ công',
    other: 'Khác',
    memberCount: ' người',
    memberCount2: 'Thành viên',
    genLabel: 'F',
    downline: 'Cấp dưới',
    downline2: 'cấp dưới',
    downlineOrg: 'Cấp dưới',
    todayEarning: 'Thu nhập hôm nay',
    totalSales: 'Tổng doanh số',
    salesLabel: 'Doanh số',
    deepGenMembers: 'Thành viên F3+',
    genSummary: '📊 Tóm tắt theo cấp',
    emptyGen: 'Không có thành viên cấp dưới',
    emptyDeepGen: 'Không có thành viên F3+ cấp dưới',
    needMore: 'Cần thêm',
    moreNeeded: 'cần thêm',
    condMet: 'Đạt điều kiện thành viên!',
    freezeCondMet: 'Đạt điều kiện FREEZE!',
    noCond: 'Không có điều kiện',
    needed: 'cần',
    membersLabel: 'Thành viên',
    authInvalidEmail: 'Email không hợp lệ.',
    authUserNotFound: 'Email chưa đăng ký.',
    authWrongPw: 'Mật khẩu không đúng.',
    authEmailUsed: 'Email đã được sử dụng.',
    authWeakPw: 'Mật khẩu quá yếu. Vui lòng sử dụng ít nhất 6 ký tự gồm chữ và số.',
    authInvalidCred: 'Email hoặc mật khẩu không đúng.',
    authTooMany: 'Quá nhiều lần thử. Vui lòng thử lại sau.',
    authNetworkFail: 'Lỗi mạng.',
    authDisabled: 'Tài khoản bị vô hiệu hóa. Liên hệ admin.',
    authError: 'Lỗi: ',
    txTypeDeposit: 'Nạp USDT',
    txTypeWithdraw: 'Rút tiền (USDT)',
    txTypeBonus: 'Thưởng',
    txTypeInvest: 'FREEZE',
    txTypeGame: 'Game',
    txTypeReferral: 'Giới thiệu',
    pwaTitle: 'Cài đặt ứng dụng DEEDRA',
    pwaDesc: 'Thêm vào màn hình chính để truy cập nhanh hơn',
    pwaBtn: 'Cài đặt',
    pwaInstalled: '✅ Ứng dụng DEEDRA đã được cài đặt!',
    referralConfirmed: 'Người giới thiệu',
    confirmed: 'Đã xác nhận',
    ddraLivePrice: '💎 Giá DDRA Hiện Tại',
    earnSeeAll: 'Xem tất cả ›',
    freezingNow: 'Đang FREEZE',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: 'DDRA Có thể rút',
    networkEarnings: '🌐 Thu nhập Mạng lưới',
    networkDetail: 'Xem chi tiết',
    todayEarn: 'Thu nhập hôm nay',
    subMembers: 'Thành viên cấp dưới',
    totalEarnings: 'Tổng thu nhập',
    membersUnit: '',
    recentGameLog: '📋 Lịch sử Game gần đây',
    withdrawableDdraLabel: 'DDRA Có thể rút (Thu nhập)',
    networkPanelTitle: '🌐 Thu nhập Mạng lưới',
    panelTodayEarn: 'Thu nhập hôm nay',
    panelTotalEarn: 'Tổng thu nhập tích lũy',
  },
  th: {
    errWithdrawTime: 'ขณะนี้ไม่อยู่ในเวลาถอนเงิน\nสามารถถอนได้ตั้งแต่ {day} {time}',
    errWithdrawTimeToday: 'ขณะนี้ไม่อยู่ในเวลาถอนเงิน\nสามารถถอนได้วันนี้ตั้งแต่ {time}',
    errWithdrawRestricted: 'การถอนเงินถูกจำกัดอยู่ในขณะนี้',
    dayTomorrow: 'พรุ่งนี้',
    dayDayAfter: 'มะรืนนี้',
    dayNextWeek: 'สัปดาห์หน้า วัน{day}',
    daySun: 'อาทิตย์', dayMon: 'จันทร์', dayTue: 'อังคาร', dayWed: 'พุธ', dayThu: 'พฤหัสบดี', dayFri: 'ศุกร์', daySat: 'เสาร์',
    
    majorCryptoPrice: 'ราคาคริปโตหลักแบบเรียลไทม์',
    upbitRealTime: 'Upbit เรียลไทม์',
    loadingPrice: 'กำลังโหลดราคา...',
    coin_BTC: 'บิตคอยน์',
    coin_ETH: 'อีเธอร์เรียม',
    coin_SOL: 'โซลานา',
    coin_XRP: 'ริปเปิล',
    coin_DOGE: 'โดจคอยน์',
    coin_SHIB: 'ชิบะอินุ',
    coin_ADA: 'คาร์ดาโน',
    coin_AVAX: 'อะวาแลนช์',
    noSubMembers: 'ไม่มีสมาชิกดาวน์ไลน์',
    orgDepthLimitTitle: 'จำกัดสิทธิ์การดูแผนผังองค์กร',
    orgDepthLimitDesc: 'ตำแหน่ง <strong>{rank}</strong> ปัจจุบันของคุณสามารถดูได้ถึง <strong>ระดับ {depth}</strong> เท่านั้น<br>เลื่อนระดับเพื่อดูเครือข่ายที่ลึกขึ้น! 🚀',

    diceHint: 'เลือกหมายเลขเพื่อเดิมพัน',
    earnSeeAll: 'ดูรายได้ทั้งหมด',
    freezingNow: '❄️ กำลังแช่แข็ง',
    gameStartHint: 'เลือกชิปเพื่อเดิมพัน',
    labelCountry: 'ประเทศ',
    netPerfAll: 'ผลงานองค์กรทั้งหมด',
    netPerfGen1: 'ผลงาน G1',
    netPerfGen2: 'ผลงาน G2',
    networkDetail: 'รายละเอียดเครือข่าย',
    networkEarnings: 'รายได้เครือข่าย',
    playWithEarn: 'เล่นด้วยรายได้',
    rank_next_label: 'ตำแหน่งถัดไป:',
    rank_referral: 'แนะนำ',
    rank_referral_unit: ' คน',
    subMembers: 'สมาชิกระดับล่าง',
    todayEarn: 'รายได้วันนี้',
    todayEarnLabel: 'รายได้วันนี้',
    todayEarnSummary: 'สรุปรายได้วันนี้',
    totalEarnSum: 'ยอดรวมรายได้ทั้งหมด',
    totalEarnings: 'รายได้สะสม',
    totalSubMembersEarn: 'สมาชิกย่อยทั้งหมด & รายได้',
    viewDetail: 'รายละเอียด ›',
    withdrawNoticeText: '※ ใช้เวลาดำเนินการ 1-3 วัน',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: 'DDRA ที่ถอนได้',
    withdrawableDdraLabel: 'DDRA ที่ถอนได้',
    tabGen1: 'รุ่นที่ 1',
    tabGen2: 'รุ่นที่ 2',
    tabDeep: 'องค์กรลึก',
    tabTx: 'ธุรกรรม',
    emptySubGen: 'ไม่มีสมาชิกในรุ่น {gen}',
    emptyDeepGen: 'ไม่มีสมาชิกในรุ่น 3+',
    genSub: 'รุ่น {gen}',
    orgTitle: 'ผลงานองค์กร (สมาชิก {n})',
    myInvestTitle: '📋 การลงทุนของฉัน',
    emptyInvest: 'ไม่พบ FREEZE ที่กำลังใช้งาน',
    dailyReturnLabel: '❄️ ผลตอบแทนรายวัน:',
    remainDaysLabel: 'เหลือ {n} วัน',
    totalExpectedLabel: 'คาดการณ์รวม/วัน: +{n} USDT (ถอนเงินต้นได้เมื่อครบกำหนด)',
    investUnit: ' รายการ',
    perDay: '/วัน',
    productMonth1: '1 เดือน',
    productMonth3: '3 เดือน',
    productMonth6: '6 เดือน',
    productMonth12: '12 เดือน',
    productHint1: 'ผลตอบแทนรายวันสำหรับ FREEZE {min} USDT',
    productHint2: 'เงินต้นสามารถถอนได้เมื่อครบกำหนด',
    ddraConvert: 'แปลงเป็น DDRA',
    maturityDate: 'วันครบกำหนด',
    emptyNotice: 'ไม่มีประกาศ',
    loadFail: 'โหลดล้มเหลว',
        emptyTx: 'ไม่มีประวัติการทำธุรกรรม',
    chatTabGroup: 'กลุ่มของฉัน',
    chatTabUpline: 'ผู้สนับสนุน',
    chatNoSponsor: 'ไม่มีผู้สนับสนุน',
    chatFirstMessage: 'ส่งข้อความแรกของคุณ!',
    chatInputPlaceholder: 'พิมพ์ข้อความ...',
    chatSendFail: 'ส่งข้อความล้มเหลว',
    chatNewMessage: 'มีข้อความใหม่',
    chatPageTitle: 'แชท',
    fee: 'ค่าธรรมเนียม',
    globalNetwork: 'เครือข่ายระดับโลกตามเวลาจริง',
    majorCryptoPrice: 'Major Crypto Live Price',
    majorCryptoPrice: '주요 암호화폐 실시간 시세',
    newsViewerTitle: '📰 ดูข่าว',
    tickerJoined: 'ผู้ใช้ใหม่เข้าร่วมใน {city}',
    tickerDeposited: '{amt} USDT ฝากจาก {city}',
    tickerUpgraded: 'อัปเกรดอันดับใน {city}',
    tickerFreeze: '{amt} USDT FREEZE ใน {city}',
    emptyBonus: 'ไม่มีประวัติรายได้',
    emptyBonusSub: 'จะแสดงที่นี่เมื่อผู้ดูแลระบบดำเนินการสรุปยอดประจำวัน',
    emptyProducts: 'ไม่มีแผน FREEZE',
    emptyNoti: 'ไม่มีการแจ้งเตือน',
    emptyTicket: 'ไม่มีตั๋วสนับสนุน',
    emptyRef: 'ไม่มีการแนะนำ',
    notiTitleMature: '✅ FREEZE ครบกำหนด',
    notiMsgMature: '[{name}] สัญญา FREEZE ครบกำหนดแล้ว เงินต้น {amt} USDT ถูกปลดล็อคเข้ากระเป๋าของคุณ',
    toastMature: '❄️ เงินต้น FREEZE ที่ครบกำหนด {n} รายการถูกปลดล็อคแล้ว',
  
    authTagline: '🔐 FREEZE สินทรัพย์ดิจิทัลอย่างปลอดภัย',
    loginTab: 'เข้าสู่ระบบ',
    registerTab: 'สมัครสมาชิก',
    labelEmail: 'อีเมล',
    labelPassword: 'รหัสผ่าน',
    placeholderEmail: 'กรอกอีเมลของคุณ',
    placeholderPassword: 'กรอกรหัสผ่าน',
    placeholderPasswordMin: 'อย่างน้อย 4 ตัวอักษร',
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
    btnWithdraw: 'ถอนเงิน (USDT)',
    deedraPrice: 'ราคา DDRA ปัจจุบัน',
    recentUpdated: 'อัปเดต: ',
    investingNow: '❄️ FREEZE ที่ดำเนินการอยู่',
    investAmount: 'FREEZE',
    expectedReturn: 'ผลตอบแทนที่คาดหวัง',
    remaining: 'เหลือ',
    announcements: '📢 ประกาศ',
    seeAll: 'ดูทั้งหมด',
    recentTx: '💳 รายการล่าสุด',
    pageInvest: '📈 ลงทุน',
    activeInvest: 'FREEZE ที่ใช้งาน',
    totalInvest: 'FREEZE ทั้งหมด',
    expectedReturnLabel: 'ผลตอบแทนที่คาดหวัง',
    simTitle: 'เครื่องคำนวณผลตอบแทน',
    simSelectProduct: 'เลือกผลิตภัณฑ์',
    simUsdtAmount: 'จำนวน USDT',
    simInvestAmount: 'จำนวนเงินลงทุน',
    simPeriod: 'ระยะเวลา',
    simRoi: 'ROI',
    simEarning: 'รายได้ (USDT)',
    simEarningUsd: 'รายได้รวม (USDT)',
    productListTitle: '❄️ FREEZE Plans',
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
    betOddBtn: 'คี่ (Odd)',
    betEvenBtn: 'คู่ (Even)',
    newsTitle: '📰 ข่าวสาร',
    refresh: 'รีเฟรช',
    peopleUnit: ' คน',
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
    depositAddrLabel: 'ที่อยู่กระเป๋าบริษัท (Solana SPL)',
    depositAddrLoading: 'กำลังโหลดที่อยู่...',
    depositAmountLabel: 'จำนวนเงินฝาก (USDT)',
    depositTxidLabel: 'TXID (แฮชธุรกรรม)',
    depositTxidPlaceholder: 'กรอกแฮชธุรกรรม',
    depositMemoLabel: 'บันทึก (ไม่บังคับ)',
    depositMemoPlaceholder: 'กรอกบันทึก (ไม่บังคับ)',
    depositWarning: '⚠️ กรุณาฝากไปยังที่อยู่ด้านบนแล้วกรอก TXID ยอดจะอัปเดตหลังจากผู้ดูแลอนุมัติ',
    btnCancel: 'ยกเลิก',
    btnSubmitDeposit: 'ส่งคำขอฝาก',
    modalWithdraw: '💸 คำขอถอนเงิน (USDT)',
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
    toastPwMin: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร',
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
    cancel: 'ยกเลิก',
    confirm: 'ยืนยัน',
    failPrefix: 'ล้มเหลว: ',
    saveFail: 'บันทึกล้มเหลว: ',
    regFail: 'ลงทะเบียนล้มเหลว: ',
    days: ' วัน',
    units: '',
    emptyProducts: 'ไม่มีสินค้า',
    emptyAnnounce: 'ไม่มีประกาศ',
    emptyTx: 'ไม่มีรายการ',
    emptyBonus: 'ยังไม่มีรายได้',
    emptyBonusSub: 'รายได้จะแสดงหลังจากแอดมินรันการชำระเงินรายวัน',
    emptyNotice: 'ไม่พบประกาศ',
    loadFail: 'โหลดล้มเหลว',
    loading: 'กำลังโหลด...',
    noTitle: 'ไม่มีชื่อ',
    noContent: 'ไม่มีเนื้อหา',
    pinBadge: 'ประกาศ',
    statusPending: 'รอดำเนินการ',
    statusApproved: 'เสร็จสิ้น',
    statusRejected: 'ถูกปฏิเสธ',
    greetingDawn: 'ขยันมากเลย! 🌙',
    greetingMorning: 'สวัสดีตอนเช้า ☀️',
    greetingAfternoon: 'สวัสดี 👋',
    greetingEvening: 'สวัสดีตอนเย็น 🌆',
    freezeOngoing: 'FREEZE กำลังดำเนินการ',
    daysRemain: ' วันที่เหลือ',
    dailyRoi: 'ROI รายวัน',
    perioDays: 'วัน',
    minAmount: 'ขั้นต่ำ $',
    bonusRoiIncome: '❄️ FREEZE ROI',
    bonusDirectBonus: '👥 โบนัสตรง',
    bonusUnilevelBonus: '🌐 โบนัส Unilevel',
    bonusRankBonus: '🏆 โบนัสอันดับ',
    bonusDefault: 'โบนัส',
    bonusSettleDate: 'วันชำระ: ',
    bonusLevel: ' ระดับ',
    bonusBaseIncome: 'พื้นฐาน: $',
    bonusCompleted: 'เสร็จสิ้น',
    winText: 'ชนะ',
    loseText: 'แพ้',
    priceUpdated: 'อัปเดต: ',
    walletConnecting: 'กำลังเชื่อมต่อ...',
    walletInquiring: 'กำลังตรวจสอบ...',
    walletConnected: 'เชื่อมต่อแล้ว',
    walletNoWallet: '❌ ไม่พบวอลเล็ต\nกรุณาติดตั้ง Phantom หรือ TokenPocket',
    walletCancelConnect: 'ยกเลิกการเชื่อมต่อ',
    walletMovingApp: 'กำลังเปิดแอป...',
    walletConnectFirst: 'กรุณาเชื่อมต่อวอลเล็ตก่อน',
    walletMinDeposit: 'ฝากขั้นต่ำ $1 USDT',
    walletNoCompanyAddr: '❌ ที่อยู่วอลเล็ตบริษัทยังไม่ได้กำหนด',
    walletProcessing: '⏳ กำลังประมวลผล...',
    walletSigning: '🔐 กำลังขอลายเซ็นวอลเล็ต... (ตรวจสอบ popup วอลเล็ต)',
    walletVerifying: '📡 กำลังตรวจสอบบนเชน... (สูงสุด 30 วินาที)',
    walletDepositComplete: '✅ ฝากเสร็จสิ้น! ยอดคงเหลืออัปเดตอัตโนมัติ',
    walletDepositPending: '⏳ โอนเสร็จแล้ว! รอแอดมินอนุมัติ',
    walletTransferDone: 'โอนเสร็จแล้ว! รอแอดมินอนุมัติ',
    walletCancelSign: 'ยกเลิกลายเซ็น',
    walletDisconnected: 'วอลเล็ตหลุดการเชื่อมต่อ กรุณาเชื่อมต่อใหม่',
    walletInsufficientSol: '❌ ยอด USDT หรือ SOL ไม่เพียงพอ',
    walletInsufficientSolMsg: '❌ ยอดไม่เพียงพอ (ตรวจสอบ USDT หรือ SOL สำหรับค่าธรรมเนียม)',
    walletTransferFail: 'โอนล้มเหลว',
    walletBtnSend: '🚀 ส่งผ่านวอลเล็ต',
    walletBtnConnect: '👻 Phantom / เชื่อมต่อวอลเล็ต',
    walletModuleFail: '❌ โหลดโมดูลวอลเล็ตล้มเหลว',
    walletFeeNote: 'จำนวน $',
    walletFeeNote2: ' USDT + ค่าธรรมเนียมเครือข่าย ~$0.001',
    ddraAdding: ' กำลังเพิ่ม...',
    ddraAdded: ' เพิ่ม DDRA แล้ว!',
    ddraAddedMsg: ' เพิ่ม token DDRA แล้ว!',
    ddraBtnAdd: 'เพิ่ม DDRA ในวอลเล็ต',
    ddraCanceled: 'ยกเลิกแล้ว',
    ddraAddFail: 'เพิ่ม token ล้มเหลว',
    ddraError: '❌ ข้อผิดพลาด: ',
    ddraNoWalletTitle: '🔗 ต้องการวอลเล็ต',
    ddraNoWalletDesc: 'คุณต้องการวอลเล็ตที่รองรับเพื่อเพิ่ม token DDRA',
    ddraInstall: 'ติดตั้ง →',
    ddraClose: 'ปิด',
    ddraManualTitle: '🪙 เพิ่ม DDRA ด้วยตนเอง',
    ddraManualDesc: 'กรอกที่อยู่ด้านล่างโดยตรงในวอลเล็ตของคุณ',
    ddraSolLabel: 'ที่อยู่ SPL Token Mint',
    ddraBscLabel: 'ที่อยู่ BEP-20 Contract',
    ddraCopy: 'คัดลอก',
    ddraCopied: '✅ คัดลอกแล้ว',
    ddraAdminPending: 'รอแอดมินตั้งค่า',
    loginFail: 'เข้าสู่ระบบล้มเหลว',
    loginError: 'เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ',
    registerEnterName: 'กรุณากรอกชื่อ',
    registerEnterPhone: 'กรุณากรอกเบอร์โทร',
    registerEnterEmail: 'กรุณากรอกอีเมล',
    registerEnterPw: 'กรุณากรอกรหัสผ่าน',
    registerPwMin: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    registerSelectCountry: 'กรุณาเลือกประเทศ',
    registerRefRequired: 'รหัสแนะนำจำเป็นต้องกรอก',
    registerInvalidRef: 'รหัสแนะนำไม่ถูกต้อง',
    registerDone: 'สมัครสำเร็จ! ยินดีต้อนรับ 🎉',
    forgotEmailFirst: 'กรุณากรอกอีเมลก่อน',
    forgotEmailSent: 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว',
    loginIdPwRequired: 'กรุณากรอก ID และรหัสผ่าน',
    initFail: 'เริ่มต้นล้มเหลว กรุณาลองใหม่',
    langChanged: 'เปลี่ยนภาษาแล้ว',
    walletAddrNotSet: 'ยังไม่ได้ตั้งที่อยู่ (ติดต่อผู้ดูแล)',
    noGameDdra: 'ไม่มี DDRA สำหรับเล่นเกม ต้องมีรายได้จาก FREEZE ก่อน',
    coinFlying: 'เหรียญกำลังบิน...',
    result: 'ผลลัพธ์',
    diceHit: 'ถูก!',
    diceMiss: 'พลาด',
    diceResult: 'หน้าที่ออก',
    jackpot: 'แจ็คพอต!',
    slotMiss: 'ไม่ถูก!',
    spinAgain: 'หมุนอีกครั้ง!',
    number: 'หมายเลข',
    rlRed2: 'แดง',
    rlBlack2: 'ดำ',
    rlZero2: 'ศูนย์',
    rlOdd2: 'คี่',
    rlEven2: 'คู่',
    rlLow2: '1~18',
    rlHigh2: '19~36',
    bacPlayerWin: 'Player ชนะ',
    bacBankerWin: 'Banker ชนะ',
    bacTie: 'เสมอ',
    bacTiePush: 'เสมอ - คืนเดิมพัน',
    bacPlayerWinBankerLose: 'Player ชนะ, เดิมพัน Banker แพ้',
    bacBankerWinPlayerLose: 'Banker ชนะ, เดิมพัน Player แพ้',
    bacPlayer: 'Player',
    bacBanker: 'Banker',
    pkRoyal: 'Royal Flush',
    pkStraightFlush: 'Straight Flush',
    pkFour: 'สี่ตัวเหมือน',
    pkFullHouse: 'Full House',
    pkFlush: 'Flush',
    pkStraight: 'Straight',
    pkThree: 'สามตัวเหมือน',
    pkTwoPair: 'สองคู่',
    pkOnePair: 'หนึ่งคู่',
    pkHighCard: 'ไฮการ์ด',
    pkDeal: 'แจกไพ่',
    pkDealing: 'กำลังแจก...',
    pkReDeal: 'แจกใหม่!',
    pkDealerNoQual: 'ดีลเลอร์ไม่ผ่าน! คืน ante',
    pkDealer: 'ดีลเลอร์',
    pkMyHand: 'ไพ่ของฉัน',
    pkDealerWin: 'ดีลเลอร์ชนะ',
    pkTie: 'เสมอ! คืนเดิมพัน',
    emptyFreezePlan: 'ไม่มีแผน FREEZE',
    emptyActiveFreeze: 'ไม่มี FREEZE ที่ทำงานอยู่',
    periodLabel: 'ระยะเวลา',
    minLabel: 'ขั้นต่ำ',
    maxLabel: 'สูงสุด',
    productHint3: 'FREEZE รายได้รายวัน',
    approx: '≈',
    principalUnfreeze: 'เงินต้นสามารถถอนได้หลังครบกำหนด',
    ddraEquiv: 'เทียบเท่า DDRA',
    expiryDate: 'วันครบกำหนด',
    investTotalReturn: 'ผลตอบแทนรวมที่คาดหวัง (ต่อวัน)',
    simTotal: 'รวม',
    condNotSet: 'ไม่มีเงื่อนไข',
    topRankAchieved: 'ถึงระดับสูงสุดแล้ว! 🏆',
    emptyRefs: 'ไม่มีผู้แนะนำ',
    shareToExpand: 'แชร์ลิงก์แนะนำเพื่อขยายเครือข่าย!',
    me: 'ฉัน',
    member: 'สมาชิก',
    joinedOn: 'เข้าร่วม',
    referralCodeLabel: 'รหัสแนะนำ',
    noName: 'ไม่มีชื่อ',
    emptyTickets: 'ไม่มีการสอบถาม',
    ticketClosed: 'ตอบแล้ว',
    ticketProcessing: 'กำลังดำเนินการ',
    registering: 'กำลังส่ง...',
    emptyNotifs: 'ไม่มีการแจ้งเตือน',
    saving: 'กำลังบันทึก...',
    withdrawFee: 'ค่าธรรมเนียม',
    toastWithdrawDone2: 'ส่งคำขอถอนเงินแล้ว!',
    bonusRoiIncome2: '💎 รายได้ ROI',
    bonusDirectBonus2: '👤 โบนัสตรง',
    bonusCenterFee: '🏢 ค่าธรรมเนียมศูนย์',
    bonusManual: '🎁 โบนัสพิเศษ',
    other: 'อื่นๆ',
    memberCount: ' คน',
    memberCount2: 'สมาชิก',
    genLabel: 'ชั้น',
    downline: 'ดาวน์ไลน์',
    downline2: 'ดาวน์ไลน์',
    downlineOrg: 'ดาวน์ไลน์',
    todayEarning: 'รายได้วันนี้',
    totalSales: 'ยอดขายรวม',
    salesLabel: 'ยอดขาย',
    deepGenMembers: 'สมาชิกชั้น3+',
    genSummary: '📊 สรุปตามชั้น',
    emptyGen: 'ไม่มีสมาชิกดาวน์ไลน์',
    emptyDeepGen: 'ไม่มีสมาชิกดาวน์ไลน์ชั้น3+',
    needMore: 'ต้องการเพิ่ม',
    moreNeeded: 'อีก',
    condMet: 'ถึงเงื่อนไขสมาชิกแล้ว!',
    freezeCondMet: 'ถึงเงื่อนไข FREEZE แล้ว!',
    noCond: 'ไม่มีเงื่อนไข',
    needed: 'ต้องการ',
    membersLabel: 'สมาชิก',
    authInvalidEmail: 'อีเมลไม่ถูกต้อง',
    authUserNotFound: 'ไม่พบอีเมลนี้',
    authWrongPw: 'รหัสผ่านไม่ถูกต้อง',
    authEmailUsed: 'อีเมลนี้ถูกใช้แล้ว',
    authWeakPw: 'รหัสผ่านอ่อนเกินไป โปรดใช้อย่างน้อย 6 ตัวอักษรที่มีทั้งตัวอักษรและตัวเลข',
    authInvalidCred: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    authTooMany: 'ลองหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง',
    authNetworkFail: 'เกิดข้อผิดพลาดเครือข่าย',
    authDisabled: 'บัญชีถูกระงับ ติดต่อผู้ดูแล',
    authError: 'เกิดข้อผิดพลาด: ',
    txTypeDeposit: 'ฝาก USDT',
    txTypeWithdraw: 'ถอนเงิน (USDT)',
    txTypeBonus: 'โบนัส',
    txTypeInvest: 'FREEZE',
    txTypeGame: 'เกม',
    txTypeReferral: 'แนะนำ',
    pwaTitle: 'ติดตั้งแอป DEEDRA',
    pwaDesc: 'เพิ่มหน้าจอหลักเพื่อเข้าถึงได้เร็วขึ้น',
    pwaBtn: 'ติดตั้ง',
    pwaInstalled: '✅ ติดตั้งแอป DEEDRA แล้ว!',
    referralConfirmed: 'ผู้แนะนำ',
    confirmed: 'ยืนยันแล้ว',
    ddraLivePrice: '💎 ราคา DDRA ปัจจุบัน',
    earnSeeAll: 'ดูทั้งหมด ›',
    freezingNow: 'กำลัง FREEZE',
    withdrawableUsdt: 'Available USDT',
    withdrawableDdra: 'DDRA ที่ถอนได้',
    networkEarnings: '🌐 รายได้เครือข่าย',
    networkDetail: 'ดูรายละเอียด',
    todayEarn: 'รายได้วันนี้',
    subMembers: 'สมาชิกระดับล่าง',
    totalEarnings: 'รายได้สะสม',
    membersUnit: 'คน',
    recentGameLog: '📋 ประวัติเกมล่าสุด',
    withdrawableDdraLabel: 'DDRA ที่ถอนได้ (รายได้)',
    networkPanelTitle: '🌐 รายได้เครือข่าย',
    panelTodayEarn: 'รายได้วันนี้',
    panelTotalEarn: 'รายได้สะสมทั้งหมด',
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

// ── Privacy Mode (Added by system) ──
let isPrivacyMode = localStorage.getItem('privacyMode') === 'true';

window.togglePrivacy = function() {
  isPrivacyMode = !isPrivacyMode;
  localStorage.setItem('privacyMode', isPrivacyMode);
  
  const pToggle = document.getElementById('privacyModeToggle');
  if (pToggle) {
    if (isPrivacyMode) pToggle.classList.add('on');
    else pToggle.classList.remove('on');
  }
  
  if (walletData) {
    // try different UI refresh functions
    if (typeof updateHomeUI === 'function') updateHomeUI();
    else if (typeof updateWalletUI === 'function') updateWalletUI();
  }
};

window.privacyFmt = function(val, prefix = '', suffix = '') {
  if (isPrivacyMode) return prefix + '****' + suffix;
  return prefix + val + suffix;
};
// ──────────────────────────────────────────────

let currentPage = sessionStorage.getItem('lastPage') || 'home';
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
  const dice3d = document.getElementById('dice3d');
  if (!dice3d) return;
  // Make sure it doesn't have the animation class when forcing a result
  if (!dice3d.classList.contains('dice-rolling')) {
    let rotX = -10, rotY = -10;
    if (num === 1) { rotX = -10; rotY = -10; }
    else if (num === 6) { rotX = -10; rotY = -190; }
    else if (num === 3) { rotX = -10; rotY = -100; }
    else if (num === 4) { rotX = -10; rotY = 80; }
    else if (num === 2) { rotX = -100; rotY = 0; }
    else if (num === 5) { rotX = 80; rotY = 0; }
    dice3d.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
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

// USD → KRW 환율 (실시간 갱신 전 기본값)
const USD_KRW = 1380;

// ===== 실시간 환율 시스템 =====
// 언어 설정에 따른 통화 매핑
const LANG_CURRENCY = {
  ko: { code: 'KRW', symbol: '₩',     name: '원',   format: (v) => '₩' + Math.round(v).toLocaleString('ko-KR') },
  en: { code: 'USD', symbol: '$',     name: 'USD',  format: (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  vi: { code: 'VND', symbol: '₫',     name: 'Đồng', format: (v) => Math.round(v).toLocaleString('vi-VN') + ' ₫' },
  th: { code: 'THB', symbol: '฿',     name: 'บาท',  format: (v) => '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
};

// 실시간 환율 캐시 (1시간 유효)
let _fxRates = null;
let _fxFetchedAt = 0;
const FX_CACHE_MS = 3600_000; // 1시간

// 환율 불러오기 (백엔드 프록시 경유)
async function fetchForexRates() {
  const now = Date.now();
  if (_fxRates && now - _fxFetchedAt < FX_CACHE_MS) return _fxRates;
  try {
    const res = await fetch('/api/price/forex');
    if (!res.ok) throw new Error('forex api error');
    const data = await res.json();
    if (data.success && data.rates) {
      _fxRates = data.rates;
      _fxFetchedAt = now;
      return _fxRates;
    }
  } catch(e) { console.error("Error fetching (catch _):", e); }
  // 폴백: 하드코딩 기본값
  return { KRW: 1380, THB: 34, VND: 26000, USD: 1 };
}

// 현재 언어에 맞는 통화 정보 반환
function getCurrentCurrency() {
  const lang = (typeof currentLang !== 'undefined') ? currentLang : 'ko';
  return LANG_CURRENCY[lang] || LANG_CURRENCY.ko;
}

// USDT(USD) 금액을 현재 언어 통화로 변환하여 문자열 반환
function formatLocalCurrency(usdtAmount) {
  const cur = getCurrentCurrency();
  const rate = (_fxRates && _fxRates[cur.code]) ? _fxRates[cur.code] : (cur.code === 'KRW' ? 1380 : cur.code === 'THB' ? 34 : cur.code === 'VND' ? 26000 : 1);
  const localAmount = usdtAmount * rate;
  return cur.format(localAmount);
}

// 환율 정보 텍스트 (예: "1 USDT = ₩1,380")
function getForexInfoText() {
  const cur = getCurrentCurrency();
  if (cur.code === 'USD') return ''; // USD는 환율 표시 불필요
  const rate = (_fxRates && _fxRates[cur.code]) ? _fxRates[cur.code] : null;
  if (!rate) return '';
  const rateStr = cur.code === 'KRW' ? Math.round(rate).toLocaleString() :
                  cur.code === 'VND' ? Math.round(rate).toLocaleString() :
                  rate.toFixed(2);
  return `1 USDT ≈ ${cur.symbol}${rateStr}`;
}

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
    

  console.log('initApp: started');
  try {
    const { doc, getDoc, db } = window.FB;
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));

    if (!userSnap.exists()) {
      await createUserData(currentUser);
    } else {
      userData = userSnap.data();
      if (document.getElementById('autoCompoundSwitch')) {
        const isAcChecked = !!userData.autoCompound;
        document.getElementById('autoCompoundSwitch').checked = isAcChecked;
        if(typeof updateAutoCompoundUI === 'function') updateAutoCompoundUI(isAcChecked);
      }

    
    // 온라인 상태 업데이트 핑 (1분마다 lastSeenAt 갱신)
    async function updateOnlineStatus() {
      if (currentUser) {
        try {
          await window.FB.updateDoc(window.FB.doc(db, 'users', currentUser.uid), {
            lastSeenAt: Date.now()
          });
        } catch(e) { }
      }
    }
    updateOnlineStatus();
    setInterval(updateOnlineStatus, 60000);

    // 유저 데이터 실시간 구독 (직급 상승 등 감지)
    if (window._userUnsubscribe) window._userUnsubscribe();
    window._userUnsubscribe = window.FB.onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const newData = docSnap.data();
        const newRank = newData.rank || 'G0';
        userData = newData;
        if (document.getElementById('autoCompoundSwitch')) {
          const isAcChecked = !!userData.autoCompound;
        document.getElementById('autoCompoundSwitch').checked = isAcChecked;
        if(typeof updateAutoCompoundUI === 'function') updateAutoCompoundUI(isAcChecked);
        }
        
        // 직급 상승 감지 (오프라인 상승 시 로그인 후 1회 표시를 위해 localStorage 사용)
        const rankOrder = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
        const storageKey = 'last_seen_rank_' + currentUser.uid;
        const lastSeenRank = localStorage.getItem(storageKey) || 'G0';
        
        const lastIdx = Math.max(0, rankOrder.indexOf(lastSeenRank));
        const newIdx = Math.max(0, rankOrder.indexOf(newRank));
        
        if (newIdx > lastIdx) {
          if (typeof triggerRankUpAnimation === 'function') {
            triggerRankUpAnimation(newRank);
          }
          localStorage.setItem(storageKey, newRank);
        } else if (newIdx < lastIdx) {
          // 강등되거나 초기화된 경우 동기화
          localStorage.setItem(storageKey, newRank);
        }
        
        // UI 갱신 (메인 화면, 헤더 등)
        updateHomeUI();
        updateRankUI();
      }
    });

    }

    // 직급 승진 조건 설정 로드 (에러 무시)
    try {
      const promoSnap = await getDoc(doc(db, 'settings', 'rankPromotion'));
      if (promoSnap.exists()) rankPromoSettings = promoSnap.data();
    } catch(e) { /* 설정 없으면 기본값 사용 */ }

    // DDRA 토큰 등록 설정 로드
    if (window.DDRATokenRegister) {
      window.DDRATokenRegister.loadConfig(db, doc, getDoc).catch(() => {});
    }

    console.log('initApp: before loadWalletData'); await loadWalletData(); console.log('initApp: after loadWalletData');
    console.log('initApp: before loadDeedraPrice'); await loadDeedraPrice(); console.log('initApp: after loadDeedraPrice');
    console.log('initApp: before loadGameOdds'); await loadGameOdds(); console.log('initApp: after loadGameOdds');

    // 실시간 환율 로드 (백그라운드 - UI 블로킹 없음)
    fetchForexRates().then(() => {
      // 환율 로드 완료 후 자산 카드 즉시 갱신
      updateHomeUI();
    }).catch(() => {});

    console.log('initApp: showing main screen'); showScreen('main');
    // Restore last visited page
    if (typeof window.switchPage === 'function') window.switchPage(currentPage);
    // 강제 비밀번호 변경 체크
    if (sessionStorage.getItem('deedra_force_pw') === '1' || userData?.forcePwChange === true) {
      const modal = document.getElementById('forcePwModal');
      if (modal) modal.style.display = 'flex';
    } else {
      // 지갑 주소 미등록 시 로그인 당 1회 팝업
      if (!sessionStorage.getItem('deedra_wallet_popup_shown') && !userData?.solanaWallet) {
        sessionStorage.setItem('deedra_wallet_popup_shown', '1');
        setTimeout(() => {
            if (typeof window.showWalletRegisterModal === 'function') {
                window.showWalletRegisterModal();
            }
        }, 1200);
      }
    }


    updateHomeUI();
    loadAnnouncements();
    if (typeof loadNewsFeed === "function") loadNewsFeed();
    loadRecentTransactions();
    loadDDayCard();
    loadHomeEarn();
    startNotificationListener();
    // 홈 네트워크 수익 미리보기 로드
    setTimeout(() => _loadNepSummary && _loadNepSummary(), 800);
    // ROI 당일 정산 미실행 시 큐 등록 (백그라운드, UX 무관)
    setTimeout(() => checkAndTriggerDailyROI(), 3000);
    if (window.chatManager && typeof window.chatManager.init === "function") {
      window.chatManager.init();
    }
    // 홈 오늘 수익 카드 로드
    setTimeout(() => loadTodayEarnCard(), 1500);

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
    withdrawPin: null, centerId: null,
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
  const { doc, getDoc, db, onSnapshot } = window.FB;
  const ref = doc(db, 'wallets', currentUser.uid);
  
  // 첫 데이터는 동기적으로 가져옴 (초기화 보장)
  const snap = await getDoc(ref);
  walletData = snap.exists() ? snap.data() : { usdtBalance: 0, dedraBalance: 0, bonusBalance: 0 };
  gameBalanceVal = Math.floor(((walletData.bonusBalance || 0) / (deedraPrice || 0.5)) * 100) / 100;

  // 실시간 구독 설정 (입금 승인 시 즉시 반영)
  if (window._walletUnsubscribe) window._walletUnsubscribe();
  window._walletUnsubscribe = onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      walletData = docSnap.data();
      gameBalanceVal = Math.floor(((walletData.bonusBalance || 0) / (deedraPrice || 0.5)) * 100) / 100;
      updateWalletUI(); // UI 갱신 (총자산 등 애니메이션 포함)
    }
  });
}

// ===== DEEDRA 실시간 가격 시스템 =====
let _livePrice_timer    = null;
let _livePrice_enabled  = false;
let _livePrice_pair     = 'CCWoFvKBpLLykQZs3YBaAFGG7qS9aztSCYq5L1AY6S9c'; // Raydium DDRA/SOL 페어 주소

// Firestore에서 설정 로드 + 실시간이면 폴링 시작
async function loadDeedraPrice() {
  try {
    const { doc, getDoc, db } = window.FB;
    const snap = await getDoc(doc(db, 'settings', 'deedraPrice'));
    if (snap.exists()) {
      const d = snap.data();
      deedraPrice        = d.price || 0.50;
      _livePrice_enabled = d.liveEnabled || false;
      // pairAddress 우선, mintAddress 폴백 (하위 호환)
      _livePrice_pair    = d.pairAddress || d.mintAddress || 'CCWoFvKBpLLykQZs3YBaAFGG7qS9aztSCYq5L1AY6S9c';
      updatePriceTicker(deedraPrice, d.updatedAt, d.source, d.priceChange24h, _livePrice_enabled);
      if (_livePrice_enabled && _livePrice_pair) {
        _startClientLivePolling(_livePrice_pair);
      }
    } else {
      updatePriceTicker(0.50, null, null, null, false);
    }
  } catch (err) {
    updatePriceTicker(0.50, null, null, null, false);
  }
}

// 앱 측 실시간 폴링 (30초 간격으로 백엔드 프록시 API 호출)
function _startClientLivePolling(pair) {
  if (_livePrice_timer) clearInterval(_livePrice_timer);
  _fetchAndApplyLivePrice(pair);
  _livePrice_timer = setInterval(() => _fetchAndApplyLivePrice(pair), 30000);
}

async function _fetchAndApplyLivePrice(pair) {
  try {
    // 페어 주소로 직접 조회
    const res  = await fetch(`/api/price/token?pair=${encodeURIComponent(pair)}`);
    const data = await res.json();
    if (!data.success || !data.price) return;
    deedraPrice = data.price;

    
    updatePriceTicker(deedraPrice, null, data.source, data.priceChange24h, true);
    // Firestore에 갱신 (타임스탬프 업데이트)
    try {
      const { doc, setDoc, serverTimestamp, db } = window.FB;
      await setDoc(doc(db, 'settings', 'deedraPrice'), {
        price: deedraPrice,
        source: data.source,
        priceChange24h: data.priceChange24h,
        liveEnabled: true,
        pairAddress: pair,
        mintAddress: pair, // 하위 호환
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch(_) {}
  } catch(_) {}
}

function updatePriceTicker(price, updatedAt, source, priceChange24h, liveEnabled) {
  const el       = document.getElementById('deedraPrice');
  const subEl    = document.getElementById('deedraUpdated');
  const changeEl = document.getElementById('deedraChange');

  if (el) el.textContent = '$' + (price || 0).toFixed(6);
  if (subEl) {
    let subText = updatedAt ? t('priceUpdated') + fmtDate(updatedAt) : '';
    if (source && source !== 'manual') subText += (subText ? ' · ' : '') + '📡 ' + source;
    if (liveEnabled) subText += (subText ? ' · ' : '') + '🔴 LIVE';
    subEl.textContent = subText;
  }
  if (changeEl) {
    const chText = priceChange24h != null
      ? `1 DDRA = $${(price||0).toFixed(6)} (${priceChange24h >= 0 ? '▲' : '▼'}${Math.abs(priceChange24h).toFixed(2)}%)`
      : `1 DDRA = $${(price||0).toFixed(6)}`;
    changeEl.textContent = chText;
    changeEl.style.color = priceChange24h > 0 ? '#ef4444' : priceChange24h < 0 ? '#3b82f6' : ''; // Upbit style (Red for UP, Blue for DOWN)
  }

  // ─── 모든 환율 적용 UI 즉시 갱신 ───────────────────────────────────────
  if (!walletData) return;
  const p = price || 0.5;

  // 수익잔액(bonusBalance, USDT) → 출금 가능 DDRA 환산
  const bonus = walletData.bonusBalance || 0;
  const withdrawableDdra = bonus / p;  // 출금 가능 DDRA = bonusBalance ÷ ddraPrice
  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

  // splitBonusDdra: USDT 수익의 DDRA 환산 표시
  setEl('splitBonusDdra',      '≈ ' + fmt(withdrawableDdra) + ' DDRA');
  setEl('moreWalletBonusDdra', fmt(withdrawableDdra) + ' DDRA');

  // splitDedraUsd: dedraBalance는 게임 전용이므로 표시만 유지
  const dedraUsd = (walletData.dedraBalance || 0) * p;
  setEl('splitDedraUsd',    '≈ $' + fmt(dedraUsd));
  setEl('moreWalletDedraUsd', privacyFmt(fmt(dedraUsd), '≈ $'));

  // 게임 잔액: bonusBalance(USDT) ÷ ddraPrice → DDRA 단위
  gameBalanceVal = Math.floor(((walletData.bonusBalance || 0) / (deedraPrice || 0.5)) * 100) / 100;
  setEl('gameBalanceUsd', '≈ $' + fmt(bonus));

  // 출금 모달 DDRA 환산 업데이트
  if (typeof updateWithdrawDdraCalc === "function") updateWithdrawDdraCalc();
}



// ===== 홈 EARN 패널 - 상품 미리보기 로드 =====
async function loadHomeEarn() {
  setTimeout(window.initLiveTransactionMarquee, 500);
  const listEl = document.getElementById('homeEarnList');
  if (!listEl) return;

  try {
    const { collection, getDocs, query, where, db } = window.FB;

    // 상품 로드 (캐시 활용)
    if (!productsCache || !productsCache.length) {
      const snap = await getDocs(collection(db, 'products'));
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      productsCache = allDocs
        .filter(p => !p.type || p.type === 'investment')
        .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));
    }

    // 내 활성 투자 로드
    let myInvestments = [];
    if (currentUser) {
      try {
        const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
        const iSnap = await getDocs(q);
        myInvestments = iSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => inv.status === 'active');
      } catch(e) { /* 조용히 */ }
    }

    renderHomeEarn(productsCache, myInvestments);
    renderHomeInvestCards(myInvestments, productsCache);
    updateTodayEarnSummary(myInvestments);
  } catch (e) {
    console.error('[EARN] 상품 로드 오류:', e);
    listEl.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,0.35);text-align:center;padding:12px 0;">${t('emptyProducts')}</div>`;
  }
}

// 상품 색상/아이콘 (상품 순서별)
const EARN_PROD_COLORS = [
  'linear-gradient(135deg,#1e3a5f,#0d4f3c)',
  'linear-gradient(135deg,#1e3060,#2d1b69)',
  'linear-gradient(135deg,#3d1a00,#5b2d00)',
  'linear-gradient(135deg,#1a1a2e,#16213e)'
];
const EARN_PROD_ICONS = ['❄️','💎','👑','🔥'];

function renderHomeEarn(products, myInvestments) {
  const listEl = document.getElementById('homeEarnList');
  if (!listEl) return;
  if (!products || !products.length) {
    listEl.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,0.35);text-align:center;padding:12px 0;">${t('emptyProducts')}</div>`;
    return;
  }

  // 내 활성 투자 상품 ID/이름 세트
  const myProductIds = new Set((myInvestments || []).map(inv => inv.productId || inv.productName));
  // 구매한 투자의 데일리 수익 맵 (productName → dailyEarn)
  const myDailyEarnMap = {};
  (myInvestments || []).forEach(inv => {
    const roi = (inv.roiPercent != null ? inv.roiPercent : inv.dailyRoi || 0) / 100;
    const earn = (inv.amount || 0) * roi;
    const key = inv.productId || inv.productName;
    myDailyEarnMap[key] = (myDailyEarnMap[key] || 0) + earn;
  });

  // 최대 4개 리스트 표시 (얇게)
  const show = products.slice(0, 4);
  listEl.innerHTML = show.map((p, i) => {
    const roi = p.roiPercent != null ? p.roiPercent : (p.dailyRoi != null ? p.dailyRoi : 0);
    const days = p.durationDays != null ? p.durationDays : (p.duration != null ? p.duration : '-');
    const isPurchased = myProductIds.has(p.id) || myProductIds.has(p.name);
    const icon = EARN_PROD_ICONS[i % EARN_PROD_ICONS.length];

    // 구매한 상품이면 실제 수익금 표시, 아니면 최소 금액 기준 예시
    const dailyEarn = isPurchased
      ? (myDailyEarnMap[p.id] || myDailyEarnMap[p.name] || 0)
      : (p.minAmount || 0) * roi / 100;

    return `
    <div class="earn-item${isPurchased ? ' purchased' : ''}" onclick="switchPage('invest')">
      <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
        <span style="font-size:14px;flex-shrink:0;">${icon}</span>
        <div style="min-width:0;">
          <div class="earn-item-name">${(p.name && p.name.includes('1개월') ? t('productMonth1') : p.name && p.name.includes('3개월') ? t('productMonth3') : p.name && p.name.includes('6개월') ? t('productMonth6') : p.name && p.name.includes('12개월') ? t('productMonth12') : (p.name || '-'))}</div>
          <div class="earn-item-period">${parseInt(days)}${t("days")}</div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div class="earn-item-roi">${roi.toFixed(1)}%</div>
        ${isPurchased && dailyEarn > 0
          ? `<div class="earn-item-roi-label earn-roi-blink">+$${fmt(dailyEarn)}${t('perDay')}</div>`
          : `<div class="earn-item-roi-label">${t('dailyRoi')}</div>`
        }
      </div>
    </div>`;
  }).join('');
}

// ===== 오늘 수익 업데이트 =====
async function updateTodayEarnSummary(myInvestments) {
  // 데일리 수익 합계 계산 (기대 수익)
  let totalDailyEarn = 0;
  if (myInvestments && myInvestments.length) {
    myInvestments.forEach(inv => {
      const roi = (inv.roiPercent != null ? inv.roiPercent : inv.dailyRoi || 0) / 100;
      totalDailyEarn += (inv.amount || 0) * roi;
    });
  }

  // 실제 지급된 보너스 합산 (DB 조회)
  let actualRoi = 0;
  let otherBonuses = 0;
  try {
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const { collection, query, where, getDocs, limit, db } = window.FB;
    const snap = await getDocs(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid)));
    
    snap.docs.forEach(d => {
      const b = d.data();
      if (b.settlementDate === today) {
        if (b.type === 'roi_income' || b.type === 'roi') {
          actualRoi += (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0));
        } else {
          otherBonuses += (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0));
        }
      }
    });
  } catch(e) {
    console.warn('Failed to fetch today bonuses', e);
  }

  // 정산 전이면 기대수익을, 정산 후면 실제수익을 반영. 추가 네트워크 보너스는 합산.
  const effectiveRoi = actualRoi > 0 ? actualRoi : totalDailyEarn;
  const totalToday = effectiveRoi + otherBonuses;

  if (totalToday > 0) {
    const miniEl = document.getElementById('todayEarnMini');
    if (miniEl) miniEl.classList.remove('hidden');
    const el = document.getElementById('homeTodayEarn');
    
    if (el) {
      // 깜빡이는 화살표 애니메이션과 숫자 카운트업
      window.animateValue(el, 0, totalToday, 1500, (v) => {
        return `<span style="color:#ef4444; font-weight:800;">+${fmt(v)} USDT</span> <span style="color:#ef4444; font-size:12px; display:inline-block; animation: blink 1s infinite; vertical-align:middle;">▲</span>`;
      });
    }

    // 플로팅 알림 (처음 로드 시)
    if (!window._profitPopShown) {
      window._profitPopShown = true;
      showFloatingProfitPop('+$' + fmt(totalToday) + ' 오늘 수익!');
    }
  } else {
    // 투자도 없고 수익도 없으면 숨김
    if (!myInvestments || !myInvestments.length) {
      const miniEl = document.getElementById('todayEarnMini');
      if (miniEl) miniEl.classList.add('hidden');
    }
  }
}

// 플로팅 수익 팝업
function showFloatingProfitPop(text) {
  const el = document.createElement('div');
  el.className = 'floating-profit-pop';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2700);
}

// ===== 홈 투자 현황 카드 렌더링 =====
const TIER_COLORS = {
  basic:    'linear-gradient(90deg,#4caf50,#8bc34a)',
  standard: 'linear-gradient(90deg,#2196f3,#03a9f4)',
  premium:  'linear-gradient(90deg,#9c27b0,#e91e63)',
  vip:      'linear-gradient(90deg,#ff9800,#f44336)',
};
function getTier(name) {
  if (!name) return 'basic';
  if (name.includes('1개월') || name.toLowerCase().includes('basic')) return 'basic';
  if (name.includes('3개월') || name.toLowerCase().includes('standard')) return 'standard';
  if (name.includes('6개월') || name.toLowerCase().includes('premium')) return 'premium';
  if (name.includes('12개월') || name.toLowerCase().includes('vip')) return 'vip';
  return 'basic';
}

function renderHomeInvestCards(myInvestments, products) {
  const wrap = document.getElementById('homeInvestCards');
  const listEl = document.getElementById('homeInvestCardList');
  if (!wrap || !listEl) return;

  if (!myInvestments || !myInvestments.length) {
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');

  // 제품 맵
  const prodMap = {};
  (products || []).forEach(p => { prodMap[p.id] = p; prodMap[p.name] = p; });

  let totalDailyEarn = 0;

  listEl.innerHTML = myInvestments.map(inv => {
    const tier = getTier(inv.productName || '');
    const tierColor = TIER_COLORS[tier] || TIER_COLORS.basic;

    const start = inv.startDate?.toDate ? inv.startDate.toDate() : new Date(inv.startDate || Date.now());
    const end   = inv.endDate?.toDate   ? inv.endDate.toDate()   : new Date(inv.endDate   || Date.now());
    const now   = new Date();
    const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    const remainDays = Math.max(0, Math.ceil((end - now) / 86400000));
    const endStr = fmtDateShort ? fmtDateShort(end) : end.toLocaleDateString();

    const roi = (inv.roiPercent != null ? inv.roiPercent : inv.dailyRoi || 0) / 100;
    const dailyEarn = (inv.amount || 0) * roi;
    const paidRoi = inv.paidRoi || 0;

    totalDailyEarn += dailyEarn;

    // 당일 수익 표시 (블링크)
    const dailyStr = '+$' + fmt(dailyEarn);

    return `
    <div class="home-inv-card purchased">
      <div class="home-inv-card-tier-bar" style="background:${tierColor};"></div>
      <div class="home-inv-card-top">
        <div>
          <span class="home-inv-card-name">${inv.productName || 'FREEZE'}</span>
          <span class="purchased-badge">보유중</span>
        </div>
        <span class="home-inv-card-amount">$${fmt(inv.amount)}</span>
      </div>
      <div class="home-inv-card-row">
        <div class="home-inv-card-stat">
          <div class="home-inv-card-stat-label">당일 수익</div>
          <div class="home-inv-card-stat-value blink-green">${dailyStr}</div>
        </div>
        <div class="home-inv-card-stat">
          <div class="home-inv-card-stat-label">누적 수익</div>
          <div class="home-inv-card-stat-value green">$${fmt(paidRoi)}</div>
        </div>
        <div class="home-inv-card-stat">
          <div class="home-inv-card-stat-label">만기일</div>
          <div class="home-inv-card-stat-value" style="font-size:11px;">${endStr}</div>
        </div>
        <div class="home-inv-card-stat">
          <div class="home-inv-card-stat-label">잔여</div>
          <div class="home-inv-card-stat-value">${remainDays}일</div>
        </div>
      </div>
      <div class="home-inv-progress">
        <div class="home-inv-progress-fill" style="width:${progress.toFixed(1)}%"></div>
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
  localStorage.setItem('deedra_lang', lang);
  applyLang();
  // 현재 활성 페이지 재렌더링 (언어 전환 시 동적 콘텐츠도 갱신)
  if (typeof currentPage !== 'undefined' && currentPage) {
    if (currentPage === 'home') {
      if (typeof loadHomeEarn === 'function') loadHomeEarn();
      if (typeof loadAnnouncements === 'function') loadAnnouncements();
      if (typeof loadNewsFeed === "function") loadNewsFeed();
      if (typeof loadRecentTransactions === 'function') loadRecentTransactions();
      if (typeof updateHomeUI === 'function') updateHomeUI();
    } else if (currentPage === 'invest') {
      if (typeof loadInvestPage === 'function') loadInvestPage();
    } else if (currentPage === 'network') {
      if (typeof loadNetworkPage === 'function') loadNetworkPage();
    } else if (currentPage === 'play') {
      if (typeof updateGameUI === 'function') updateGameUI();
    } else if (currentPage === 'more') {
      if (typeof loadMorePage === 'function') loadMorePage();
    }
  }
  // 언어 변경 시 환율 표시도 즉시 갱신 (통화 단위가 바뀌므로)
  // 환율 재로드 후 자산 카드 업데이트
  fetchForexRates().then(() => {
    if (typeof updateHomeUI === 'function') updateHomeUI();
  }).catch(() => {
    if (typeof updateHomeUI === 'function') updateHomeUI();
  });
  showToast(t('langChanged'), 'success');
};

// ===== 화면 전환 =====
window.showScreen = function showScreen(name) {
  const loadingScreen = document.getElementById('loadingScreen');
  if(loadingScreen) loadingScreen.classList.add('hidden');
  document.getElementById('loadingScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.add('hidden');

  if (name === 'loading') document.getElementById('loadingScreen').classList.remove('hidden');
  else if (name === 'auth') document.getElementById('authScreen').classList.remove('hidden');
  else if (name === 'main') document.getElementById('mainApp').classList.remove('hidden');
}


window.confirmGameWarning = function() {
  sessionStorage.setItem('gameWarningAgreed', 'true');
  const modal = document.getElementById('gameWarningModal');
  if (modal) modal.classList.add('hidden');
  window.switchPage('play');
};

// ===== 탭 전환 =====

window.switchPage = function(page) {
  if (page === 'play') {
    const agreed = sessionStorage.getItem('gameWarningAgreed');
    if (!agreed) {
      // 만약 동의를 아직 안했다면 팝업을 띄우고 페이지 전환 중단
      const modal = document.getElementById('gameWarningModal');
      if (modal) modal.classList.remove('hidden');
      return;
    }
  }

  try {
    
  // 자체기록(페이지 뷰) 저장
  if (window.currentUser && window.FB) {
    try {
      const { addDoc, collection, db, serverTimestamp } = window.FB;
      addDoc(collection(db, 'page_views'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        page: page,
        createdAt: serverTimestamp()
      }).catch(e => console.warn('[Log] error:', e));
    } catch(e) {}
  }

  try { sessionStorage.setItem('lastPage', page); } catch(e) { console.error("Error fetching wallet/investment:", e); }
    
    // Hide all pages and remove active class from all nav items
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(page + 'Page');
    const navEl = document.getElementById('nav-' + page);
    
    if (pageEl) {
      pageEl.classList.add('active');
    } else {
      console.warn("No pageEl found for: " + page + "Page");
    }
    
    if (navEl) {
      navEl.classList.add('active');
    } else {
      console.warn("No navEl found for: nav-" + page);
    }

    currentPage = page;
    
    // 메인(home) 화면에서만 새로고침 버튼 표시
    const refreshBtn = document.getElementById('floatingRefreshBtn'); if(refreshBtn)
    if (refreshBtn) {
        refreshBtn.style.display = (page === 'home') ? 'flex' : 'none';
    }

    // Execute page specific scripts inside try-catch to prevent blocking
    setTimeout(() => {
      try {
        if (page === 'invest' && typeof loadInvestPage === 'function') loadInvestPage();
        else if (page === 'network' && typeof loadNetworkPage === 'function') loadNetworkPage();
        else if (page === 'play' && typeof updateGameUI === 'function') updateGameUI();
        else if (page === 'more' && typeof loadMorePage === 'function') loadMorePage();
        else if (page === 'podcast' && typeof window.loadUserPodcasts === 'function') window.loadUserPodcasts();
      } catch (err) {
        console.error("Error in page load function for " + page + ":", err);
      }
    }, 50);

  } catch (err) {
    console.error("switchPage fatal error:", err);
    if (typeof showToast === 'function') {
      showToast("Page switch error: " + err.message, "error");
    } else {
      alert("Page switch error: " + err.message);
    }
  }
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
  let usernameInput = document.getElementById('loginEmail').value.trim();
  if (!usernameInput.includes('@')) {
    usernameInput = usernameInput.toLowerCase();
  }
  const pw = document.getElementById('loginPassword').value;
  if (!usernameInput || !pw) { showToast(t('loginIdPwRequired'), 'warning'); return; }

  showScreen('loading');
  try {
    // username 포함 여부에 따라 로그인 방식 분기
    // @ 포함 → 기존 이메일 로그인 (관리자 등)
    // @ 미포함 → username 기반 서버 API 로그인
    if (usernameInput.includes('@')) {
      // 이메일 직접 로그인 (기존 방식 유지)
      const { signInWithEmailAndPassword, auth } = window.FB;
      const result = await signInWithEmailAndPassword(auth, usernameInput, pw);
      if (pw === '000000') sessionStorage.setItem('deedra_force_pw', '1');
      if (result?.user) {
        localStorage.setItem('deedra_session', JSON.stringify({
          uid: result.user.uid, email: result.user.email
        }));
      }
    } else {
      // username 로그인 → 서버 API 경유
      const res = await fetch('/api/auth/login-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: pw })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showScreen('auth');
        showToast(data.error || t('loginFail'), 'error');
        return;
      }
      // idToken으로 Firebase Auth에 signIn
      const { signInWithCustomToken, signInWithEmailAndPassword, auth } = window.FB;
      // idToken을 직접 사용해 Firebase 세션 시작
      try {
        const result = await signInWithEmailAndPassword(auth, data.email, pw);
        if (pw === '000000') sessionStorage.setItem('deedra_force_pw', '1');
        if (result?.user) {
          localStorage.setItem('deedra_session', JSON.stringify({
            uid: result.user.uid, email: result.user.email
          }));
        }
      } catch(e2) {
        // Firebase 직접 로그인 실패 시 → idToken으로 세션 수동 복원
        localStorage.setItem('deedra_session', JSON.stringify({
          uid: data.uid, email: data.email
        }));
        // onAuthReady 수동 트리거
        if (typeof window._onIdTokenReceived === 'function') {
          window._onIdTokenReceived(data.idToken, data.uid, data.email);
        } else {
          window.FB._idToken = data.idToken;
          window.FB._currentUser = { uid: data.uid, email: data.email };
          window.FB._useRestAPI = true;
          if (typeof window.onAuthReady === 'function') {
            window.onAuthReady(window.FB._currentUser);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Login Error]', err);
    showScreen('auth');
    showToast(getAuthErrorMsg(err.code) || (t('loginError') + ' : ' + err.message), 'error');
  }
};

// ===== 회원가입 =====
window.handleRegister = async function() {
  const name    = document.getElementById('regName').value.trim();
  const phone   = document.getElementById('regPhone')?.value.trim() || '';
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const email   = document.getElementById('regEmail').value.trim();
  const pw      = document.getElementById('regPassword').value;
  const country = document.getElementById('regCountry')?.value || '';
  const refCode = document.getElementById('regReferral').value.trim();

  if (!name)    { showToast(t('registerEnterName'), 'warning'); return; }
  if (!phone)   { showToast(t('registerEnterPhone'), 'warning'); return; }
  if (!username) { showToast(t('registerEnterUsername') || '아이디를 입력해주세요.', 'warning'); return; }
  if (!email)   { showToast(t('registerEnterEmail'), 'warning'); return; }
  if (!pw)      { showToast(t('registerEnterPw'), 'warning'); return; }
  if (pw.length < 6) { showToast(t('registerPwMin'), 'warning'); return; }
  if (!country) { showToast(t('registerSelectCountry'), 'warning'); return; }
  if (!refCode) { showToast(t('registerRefRequired'), 'warning'); return; }

  const referrer = await findUserByReferralCode(refCode);
  if (!referrer) { showToast(t('registerInvalidRef'), 'error'); return; }

  showScreen('loading');
  try {
    // 아이디 중복 체크
    const uRes = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
    const uData = await uRes.json();
    if (uData.exists) {
      showScreen('auth');
      showToast('이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.', 'error');
      return;
    }

    const { createUserWithEmailAndPassword, auth, doc, setDoc, db, serverTimestamp } = window.FB;
    const { user } = await createUserWithEmailAndPassword(auth, email, pw);
    const myCode = generateReferralCode(user.uid);

    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid, username, email, name, role: 'member', rank: 'G0', status: 'active',
      referralCode: myCode, referredBy: referrer.uid, referredByCode: referrer.referralCode || refCode,
      createdAt: serverTimestamp(), phone, country, withdrawPin: null, centerId: referrer.centerId || null,
    });
    await setDoc(doc(db, 'wallets', user.uid), {
      userId: user.uid, usdtBalance: 0, dedraBalance: 0, bonusBalance: 0,
      totalDeposit: 0, totalWithdrawal: 0, totalEarnings: 0, createdAt: serverTimestamp(),
    });
    // 이메일 인증 메일 발송
    try {
      const { sendEmailVerification } = window.FB;
      await sendEmailVerification(user);
    } catch(_) {}

    // 이메일 인증 안내 화면 표시 (자동 로그인 대신)
    showScreen('auth');
    showToast(t('registerDone'), 'success');
    // 인증 안내 팝업
    setTimeout(() => {
      const overlay = document.createElement('div');
      overlay.id = 'emailVerifyOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML = `
        <div style="background:#1e293b;border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">📧</div>
          <h3 style="color:#fff;font-size:18px;margin:0 0 10px;">${t('emailVerifyTitle') || '이메일 인증 필요'}</h3>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">${email}<br>${t('emailVerifyDesc') || '로 인증 메일을 보냈습니다.<br>메일함을 확인하고 링크를 클릭해주세요.'}</p>
          <button onclick="document.getElementById('emailVerifyOverlay').remove()" style="background:#6366f1;color:#fff;border:none;border-radius:10px;padding:12px 32px;font-size:15px;font-weight:600;cursor:pointer;width:100%;">${t('confirm') || '확인'}</button>
        </div>`;
      document.body.appendChild(overlay);
    }, 300);
  } catch (err) {
    showScreen('auth');
    showToast(getAuthErrorMsg(err.code), 'error');
  }
};

// ===== 비밀번호 찾기 =====
window.handleForgotPassword = async function() {
  const modal = document.getElementById('guestTicketModal');
  if (modal) {
    modal.style.display = 'flex';
    // auto-fill username if entered
    const currentId = document.getElementById('loginEmail').value.trim();
    if (currentId) document.getElementById('guestTicketUsername').value = currentId;
  } else {
    showToast('문의 기능을 로드할 수 없습니다.', 'error');
  }
};

window.submitGuestTicket = async function() {
  const username = document.getElementById('guestTicketUsername').value.trim();
  const name = document.getElementById('guestTicketName').value.trim();
  const phone = document.getElementById('guestTicketPhone').value.trim();

  if (!username || !name || !phone) {
    showToast('아이디, 이름, 전화번호를 모두 입력해주세요.', 'warning');
    return;
  }

  const btn = document.getElementById('btnSubmitGuestTicket');
  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    const res = await fetch('/api/tickets/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name, phone })
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '문의 등록 실패');
    
    document.getElementById('guestTicketModal').style.display = 'none';
    showToast('비밀번호 찾기 문의가 접수되었습니다. 관리자 확인 후 처리됩니다.', 'success');
    
    // clear fields
    document.getElementById('guestTicketUsername').value = '';
    document.getElementById('guestTicketName').value = '';
    document.getElementById('guestTicketPhone').value = '';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; }
    btn.textContent = '문의 등록';
  }
};

// ===== 커스텀 확인 다이얼로그 =====
function showConfirm(msg, icon = '⚠️') {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    const msgEl  = document.getElementById('confirmModalMsg');
    const iconEl = document.getElementById('confirmModalIcon');
    const okBtn  = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');
    if (!modal) { resolve(window.confirm(msg)); return; }

    msgEl.textContent  = msg;
    iconEl.textContent = icon;
    modal.style.display = 'flex';

    // 취소 버튼 텍스트도 현재 언어에 맞게
    cancelBtn.textContent = t('cancel');
    okBtn.textContent     = t('confirm');

    const cleanup = () => { modal.style.display = 'none'; };
    const onOk = () => { cleanup(); okBtn.removeEventListener('click', onOk); cancelBtn.removeEventListener('click', onCancel); resolve(true); };
    const onCancel = () => { cleanup(); okBtn.removeEventListener('click', onOk); cancelBtn.removeEventListener('click', onCancel); resolve(false); };
    const onBg = (e) => { if (e.target === modal) { onCancel(); modal.removeEventListener('click', onBg); } };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBg);
  });
}

// ===== 로그아웃 =====
window.handleLogout = async function() {
  const confirmed = await showConfirm(t('logoutConfirm'), '👋');
  if (!confirmed) return;
  const { signOut, auth } = window.FB;
  await signOut(auth);
  localStorage.removeItem('deedra_session');
  sessionStorage.removeItem('deedra_wallet_popup_shown');
  currentUser = null; userData = null; walletData = null;
  showScreen('auth');
};

// ===== 지갑 UI 빠른 갱신 (출금/투자 후 즉시 반영) =====
function updateWalletUI() {
  console.log("updateWalletUI called, walletData:", walletData);
  updateHomeUI();
  // more 페이지가 열려있으면 해당 잔액도 갱신
  if (currentPage === 'more' && walletData) {
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const bonus = walletData.bonusBalance || 0;
    const bonusDdra = bonus / (deedraPrice || 0.5);
    setEl('moreWalletUsdt', privacyFmt(fmt(walletData.usdtBalance || 0), '', ''));
    // 수익잔액(bonusBalance)을 DDRA로 표시
    setEl('moreWalletBonus', privacyFmt(fmt(bonusDdra), '', ' DDRA'));
    setEl('moreWalletBonusDdra', privacyFmt(fmt(bonus), '≈ $', ''));
    // dedraBalance(게임전용)는 내부적으로만 유지
    setEl('moreWalletDedra', privacyFmt(fmt(walletData.dedraBalance || 0), '', ' DDRA'));
    const dedraUsd = (walletData.dedraBalance || 0) * deedraPrice;
    setEl('moreWalletDedraUsd', '≈ $' + fmt(dedraUsd));
  }
}

// ===== 홈 UI 업데이트 =====

// 숫자 카운트업 애니메이션
window.animateValue = function(el, start, end, duration, formatFn) {
  if (!el) return;
  
  // 만약 시작값과 끝값이 같다면 애니메이션 없이 바로 표시
  if (start === end) {
    el.innerHTML = formatFn(end);
    return;
  }
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // easeOutCubic
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * easeOut;
    el.innerHTML = formatFn(current);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.innerHTML = formatFn(end);
    }
  };
  window.requestAnimationFrame(step);
};

function updateHomeUI() {
  setTimeout(() => { try { window.initGlobalMapAnimation && window.initGlobalMapAnimation(); }catch(e){} }, 300);

  if (!userData || !walletData) return;

  const hour = new Date().getHours();
  const greeting = hour < 6 ? t('greetingDawn') : hour < 12 ? t('greetingMorning') : hour < 18 ? t('greetingAfternoon') : t('greetingEvening');

  const greetEl = document.getElementById('greetingMsg');
  const nameEl = document.getElementById('userNameDisplay');
  const rankImg = document.getElementById('userRankBadgeImg');
  if (rankImg) { let r = (userData.rank || 'G0').trim().toLowerCase(); if(!r.match(/^g([0-9]|10)$/)) r = 'g0'; rankImg.src = '/static/ranks/' + r + '.png?v=2'; }
  if (greetEl) greetEl.textContent = greeting + ' 👋';
  if (nameEl) nameEl.textContent = (userData.name || '회원') + ' (' + (userData.referralCode || '') + ')님';
  
  // Center Manager UI toggle
  const centerBadge = document.getElementById('centerManagerBadgeWrap');
  const centerFeeTab = document.getElementById('txTabCenterFee');
  if (userData.isCenterManager) {
    if (centerBadge) centerBadge.style.display = 'flex';
    if (centerFeeTab) centerFeeTab.style.display = 'inline-block';
  } else {
    if (centerBadge) centerBadge.style.display = 'none';
    if (centerFeeTab) centerFeeTab.style.display = 'none';
  }


  const usdt = walletData.usdtBalance || 0;
  const lockedUsdt = walletData.totalInvest || 0; // 투자된 원금 합계
  const bonus = walletData.bonusBalance || 0;  // ROI 수익 적립 (USDT 기준)
  const p = deedraPrice || 0.5;
  // 총 자산 = 투자된 원금 + 잔여 USDT + ROI 수익 (bonusBalance, USDT 기준)
  const total = lockedUsdt + usdt + bonus;

  const setEl = (id, v) => { 
    const el = document.getElementById(id); 
    if (el) {
      el.textContent = v; 
    }
  };

  const pToggle = document.getElementById('privacyModeToggle');
  if (pToggle) {
    if (isPrivacyMode) pToggle.classList.add('on');
    else pToggle.classList.remove('on');
  }
  
  console.log("updateHomeUI values: total=", total, "lockedUsdt=", lockedUsdt, "usdt=", usdt, "bonus=", bonus);
  
  // 강제로 즉시 텍스트도 설정 (애니메이션이 안 돌 경우를 대비)
  setEl('totalAsset', privacyFmt(fmt(total), '', ''));
  setEl('splitUsdt', privacyFmt(fmt(lockedUsdt), '', ''));
  setEl('splitUsdtBalance', privacyFmt(fmt(usdt), '', ''));
  
  if (document.getElementById('totalAsset')) {
    const el = document.getElementById('totalAsset'); const start = parseFloat(el.getAttribute('data-last')) || 0; el.setAttribute('data-last', total); window.animateValue(el, start, total, 800, (v) => privacyFmt(fmt(v), '', ''));
  }
  
  const splitUsdtEl = document.getElementById('splitUsdt');
  if (splitUsdtEl) {
    if (lockedUsdt === 0 || lockedUsdt === "0.00" || lockedUsdt === "0") {
      splitUsdtEl.textContent = privacyFmt("0.00", "", "");
    } else {
      const start = parseFloat(splitUsdtEl.getAttribute('data-last')) || 0; splitUsdtEl.setAttribute('data-last', lockedUsdt); window.animateValue(splitUsdtEl, start, lockedUsdt, 800, (v) => privacyFmt(fmt(v), '', ''));
    }
  }
  
  const splitUsdtBalanceEl = document.getElementById('splitUsdtBalance');
  if (splitUsdtBalanceEl) {
    if (usdt === 0 || usdt === "0.00" || usdt === "0") {
      splitUsdtBalanceEl.textContent = privacyFmt("0.00", "", "");
    } else {
      const start = parseFloat(splitUsdtBalanceEl.getAttribute('data-last')) || 0; splitUsdtBalanceEl.setAttribute('data-last', usdt); window.animateValue(splitUsdtBalanceEl, start, usdt, 800, (v) => privacyFmt(fmt(v), '', ''));
    }
  }
  
  // 만약 animateValue가 씹힐 경우를 대비해 1초 뒤 한번 더 세팅
  setTimeout(() => {
    const fallbackEl = document.getElementById('splitUsdt');
    if (fallbackEl) fallbackEl.textContent = privacyFmt(fmt(lockedUsdt), '', '');
    const fallbackEl2 = document.getElementById('splitUsdtBalance');
    if (fallbackEl2) fallbackEl2.textContent = privacyFmt(fmt(usdt), '', '');
  }, 1000);
  // 실시간 환율로 현지 통화 표시 (환율 미로드 시 기본값 사용)
  setEl('totalAssetKrw', privacyFmt('≈ ' + formatLocalCurrency(total)));
  // 환율 정보 표시 (예: "1 USDT ≈ ₩1,380")
  const rateInfoEl = document.getElementById('forexRateInfo');
  const rateValueEl = document.getElementById('forexRateValue');
  if (rateInfoEl && rateValueEl) {
    const cur = getCurrentCurrency();
    if (cur.code === 'USD') {
      rateInfoEl.style.display = 'none';
    } else {
      rateInfoEl.style.display = 'flex';
      const rate = (_fxRates && _fxRates[cur.code]) ? _fxRates[cur.code] : null;
      if (rate) {
        const rateStr = cur.code === 'KRW' ? Math.round(rate).toLocaleString() :
              cur.code === 'VND' ? Math.round(rate).toLocaleString() :
              rate.toFixed(2);
        rateValueEl.textContent = cur.symbol + rateStr;
      }
    }
  }
  // splitBonus: 출금 가능 DDRA = bonusBalance(USDT 수익) ÷ ddraPrice
  // 즉, 달러 기준 수익을 출금 시점의 DDRA 시세로 환산
  const withdrawableDdra = bonus / p;
  setEl('splitBonusUsdt', privacyFmt(fmt(bonus), '', ''));
  setEl('splitBonusDdra', privacyFmt(fmt(withdrawableDdra), '≈ ', ' DDRA'));
  if(window.loadProfitHeatmap) window.loadProfitHeatmap();
}

// ===== D-Day 카드 =====
async function loadDDayCard() {
  try {
    const { collection, query, where, getDocs, limit, db } = window.FB;
    // 단일 where만 사용 → JS에서 필터·정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    // active 상태만 추려서 startDate 내림차순 → 1건
    const docs = snap.docs
      .filter(d => d.data().status === 'active')
      .sort((a, b) => (b.data().startDate?.seconds || 0) - (a.data().startDate?.seconds || 0));
    if (!docs.length) return;

    const inv = docs[0].data();
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
    setEl('ddayName', inv.productName || t('freezeOngoing'));
    setEl('ddayStart', fmtDateShort(startTs));
    setEl('ddayEnd', fmtDateShort(endTs));
    setEl('ddayAmount', fmt(inv.amount) + ' USDT');
    setEl('ddayReturn', '+' + fmt(inv.expectedReturn || 0) + ' USDT/' + t('days'));
    setEl('ddayRemain', remainDays + t('daysRemain'));

    const fill = document.getElementById('ddayFill');
    if (fill) fill.style.width = progress.toFixed(1) + '%';

  } catch (err) {
    // 조용히 실패
  }
}

// ===== 공지사항 =====
async function loadAnnouncements() {
  const { collection, query, where, getDocs, limit, db } = window.FB;
  try {
    // 단일 where만 사용 (복합 인덱스 불필요) → JS로 정렬·필터
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        // isPinned 내림차순 → createdAt 내림차순
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      })
      .slice(0, 5);
    renderAnnouncements(items, 'announcementList');
    renderAnnouncements(items, 'moreAnnouncementList');
  } catch (err) {
    console.error('[announcements] load error:', err);
    const el = document.getElementById('announcementList');
    if (el) el.innerHTML = `<div class="empty-state">${t('emptyNotice')}</div>`;
  }
}

function renderAnnouncements(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-bullhorn"></i>${t('emptyNotice')}</div>`;
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
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
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
    if (!snap.exists()) { if (bodyEl) bodyEl.innerHTML = `<div class="empty-state">${t('emptyNotice') || '공지사항을 찾을 수 없습니다.'}</div>`; return; }
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
  const { collection, query, where, getDocs, limit, db } = window.FB;
  try {
    // 단일 where → JS 정렬·슬라이스 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(tx => tx.status !== 'rejected' && tx.status !== 'failed')
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 3);
    renderTxList(txs, 'recentTxList');
  } catch (err) {
    const el = document.getElementById('recentTxList');
    if (el) el.innerHTML = '<div class="empty-state">' + (t('emptyTx') || '거래 내역이 없습니다') + '</div>';
  }
}

function renderTxList(txs, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i>' + (t('emptyTx') || '거래 내역이 없습니다') + '</div>';
    return;
  }
  const icons = { deposit: '⬇️', withdrawal: '⬆️', bonus: '🎁', invest: '📈', game: '🎮' };
  const statusTxt = { pending: '승인 대기', approved: '완료', rejected: '거부됨' };

  el.innerHTML = txs.map(tx => {
    const isPlus = ['deposit', 'bonus'].includes(tx.type);
    return `
    <div class="tx-item">
      
      <div class="tx-info">
        <div class="tx-title">${getTxTypeName(tx.type)}</div>
        <div class="tx-date">${fmtDate(tx.createdAt)}</div>
      </div>
      <div>
        <div class="tx-amount ${isPlus ? 'plus' : 'minus'}">
          ${tx.type === 'withdrawal' ? (isPlus ? '+' : '-') + fmt(tx.amountUsdt !== undefined ? tx.amountUsdt : tx.amount) + ' USDT' : (isPlus ? '+' : '-') + fmt(tx.amount) + ' ' + (tx.currency || 'USDT')}
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
  setEl('moreWalletUsdt', fmt(walletData.usdtBalance || 0));
  setEl('moreWalletBonus', privacyFmt(fmt(bonus), '', ''));  // 수익잔액
  setEl('moreWalletBonusDdra', privacyFmt(fmt(bonusDdra), '≈ ', ' DDRA'));
  setEl('moreWalletDedra', privacyFmt(fmt(dedra), '', ' DDRA'));
  setEl('moreWalletDedraUsd', '≈ $' + fmt(dedraUsd));

  // 다크모드 토글 동기화
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.className = currentTheme === 'dark' ? 'menu-item-toggle on' : 'menu-item-toggle';

  loadTxHistory('deposit');
}

async function loadTxHistory(typeFilter = window.currentTxTab) {
  if (typeFilter === 'roi') typeFilter = 'invest';
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const listEl = document.getElementById('txHistoryList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    let txs = [];
    
    const getSortTime = (item) => {
      if (item.createdAt?.seconds) return item.createdAt.seconds;
      if (typeof item.createdAt?.toMillis === 'function') return item.createdAt.toMillis() / 1000;
      if (typeof item.createdAt === 'string') return new Date(item.createdAt).getTime() / 1000;
      return 0;
    };

    // Fetch Transactions
    if (['deposit', 'withdrawal', 'invest'].includes(typeFilter)) {
      let q;
      if (typeFilter === 'invest') {
         q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', 'invest'), limit(1000));
      } else {
         q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', typeFilter), limit(1000));
      }
      const snap = await getDocs(q);
      const fetchedTxs = snap.docs.map(d => ({ id: d.id, _collection: 'transactions', ...d.data() }));
      txs = txs.concat(fetchedTxs);
      
      if (typeFilter === 'invest') {
        const invQ = query(collection(db, 'investments'), where('userId', '==', currentUser.uid), limit(1000));
        const invSnap = await getDocs(invQ);
        const fetchedInvs = invSnap.docs.map(d => ({
          id: d.id,
          _collection: 'investments',
          type: 'invest',
          amount: d.data().amount,
          createdAt: d.data().createdAt || d.data().startDate,
          ...d.data()
        }));
        txs = txs.concat(fetchedInvs);
      }
    }

    // Fetch Bonuses
    let qList = [];
    if (typeFilter === 'invest') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', 'in', ['daily_roi', 'roi', 'roi_income']), limit(1000)));
    } else if (typeFilter === 'direct_bonus') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'direct_bonus'), limit(1000)));
    } else if (typeFilter === 'rank_bonus') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_bonus'), limit(1000)));
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_gap_passthru'), limit(1000)));
    } else if (typeFilter === 'rank_matching') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override_1pct'), limit(1000)));
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override'), limit(1000)));
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_matching'), limit(1000)));
    } else if (typeFilter === 'center_fee') {
      qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'center_fee'), limit(1000)));
    }

    for (const q of qList) {
      const snap = await getDocs(q);
      const fetchedBonuses = snap.docs.map(d => ({ id: d.id, _collection: 'bonuses', ...d.data() }));
      txs = txs.concat(fetchedBonuses);
    }

    txs.sort((a, b) => getSortTime(b) - getSortTime(a));
    // 거절/실패 건 제외
    txs = txs.filter(tx => tx.status !== 'rejected' && tx.status !== 'failed');
    window.currentTxsData = txs; 

    // Initialize Date Filter
    const dateInput = document.getElementById('txHistoryDate');
    if (dateInput && !dateInput.value && !window.txDateInitialized) {
        const todayKST = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        dateInput.value = todayKST;
        window.txDateInitialized = true;
    }
    
    let filterDate = dateInput ? dateInput.value : '';

    if (txs.length === 0) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><br>' + (t('emptyTx') || '내역이 없습니다') + '</div>';
      return;
    }

    // Filter by date if applicable
    const getKSTDate = (timestamp) => new Date(timestamp * 1000 + 9 * 3600 * 1000).toISOString().slice(0,10);
    
    let filteredTxs = txs;
    if (filterDate) {
        filteredTxs = txs.filter(tx => getKSTDate(getSortTime(tx)) === filterDate);
    }

    if (filteredTxs.length === 0) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><br>해당 날짜의 내역이 없습니다.</div>';
      return;
    }

    // Grouping by date
    const grouped = {};
    filteredTxs.forEach(tx => {
        const dStr = getKSTDate(getSortTime(tx));
        if (!grouped[dStr]) grouped[dStr] = [];
        grouped[dStr].push(tx);
    });


    const typeLabel = {
      'roi': '일일 데일리 수익',
      'roi_income': '일일 데일리 수익',
      deposit: '⬇️ 입금', withdrawal: '⬆️ 출금', invest: '🔒 FREEZE',
      roi_income: '☀️ 데일리 이자', roi: '☀️ 데일리 이자', daily_roi: '☀️ 데일리 이자', 
      direct_bonus: '👥 추천 수당',
      rank_bonus: '🏆 직급 수당', rank_gap_passthru: '🏆 직급 수당(갭)',
      rank_equal_or_higher_override_1pct: '🛡️ 직급 매칭(1%)',
      rank_equal_or_higher_override: '🛡️ 직급 매칭',
      rank_matching: '🛡️ 직급 매칭',
      center_fee: '🏢 센터 피'
    };

    const tabNameMap = {
      'deposit': '⬇️ 입금',
      'withdrawal': '⬆️ 출금',
      'invest': '🔒 FREEZE 및 이자',
      'direct_bonus': '👥 추천 수당',
      'rank_bonus': '🏆 직급 수당',
      'rank_matching': '🛡️ 직급 매칭',
      'center_fee': '🏢 센터 피'
    };

    const renderItem = (item) => {
        const isBonus = item._collection === 'bonuses';
        let label = typeLabel[item.type] || item.type;
        const dateStr = fmtDate(item.createdAt);
        let details = '';
        let base = '';
        if (isBonus) {
            details = item.settlementDate ? `정산일: ${item.settlementDate}` : (item.reason || '');
            if (item.level) label += ` · ${item.level}대`;
            base = item.baseIncome ? ` · 기준수익: ${fmt(item.baseIncome)}` : (item.investAmount ? ` · FREEZE ${fmt(item.investAmount)}` : '');
        } else {
            if (item.type === 'invest') {
                const rate = item.dailyRate || item.roiPercent || item.dailyRoi || 0.8;
                details = `만기: ${item.durationDays || 360}일 (${rate}%/일) - ${item.status==='active'?'진행중':'종료'}`;
            } else {
                details = item.status === 'pending' ? '처리중' : (item.status === 'held' ? '보류중' : (item.status === 'rejected' ? '거절됨' : '완료됨'));
                if (item.txid) {
                    const shortTxid = item.txid.length > 20 ? item.txid.substring(0, 10) + '...' + item.txid.substring(item.txid.length - 10) : item.txid;
                    details += `<br>TXID: <a href="https://solscan.io/tx/${item.txid}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${shortTxid}</a>`;
                }
            }
        }
        let amtSign = (item.type === 'withdrawal' || item.type === 'invest' && !isBonus) ? '-' : '+';
        let amtColor = (amtSign === '-') ? 'minus' : 'plus';
        let amtValue = item.amountUsdt !== undefined ? item.amountUsdt : item.amount;
        let currency = (item.type === 'withdrawal') ? 'USDT' : (item.currency || 'USDT');

        return `
        <div class="tx-item">
          <div class="tx-info">
            <div class="tx-title">${label}</div>
            <div class="tx-date">${dateStr}${base}</div>
            <div class="tx-date" style="font-size:10px;color:var(--text2);">${details}</div>
          </div>
          <div>
            <div class="tx-amount ${amtColor}">${amtSign}${fmt(amtValue)} ${currency}</div>
            <div class="tx-status" style="color:${item.status==='pending' ? 'var(--yellow)' : (item.status==='held' ? 'var(--orange)' : (item.status==='rejected' ? 'var(--red)' : 'var(--green)'))}">
              ${isBonus ? '완료' : (item.status === 'pending' ? '처리중' : (item.status === 'held' ? '보류중' : (item.status === 'rejected' ? '거절됨' : '완료')))}
            </div>
          </div>
        </div>`;
    };

    let html = '';
    for (const dStr of Object.keys(grouped).sort((a,b) => b.localeCompare(a))) {
        const dayTxs = grouped[dStr];
        let totalPlus = 0;
        let totalMinus = 0;

        dayTxs.forEach(tx => {
            const isBonus = tx._collection === 'bonuses';
            let amtSign = (tx.type === 'withdrawal' || tx.type === 'invest' && !isBonus) ? '-' : '+';
            let amtValue = tx.amountUsdt !== undefined ? tx.amountUsdt : tx.amount;
            if (amtSign === '+') totalPlus += Number(amtValue||0);
            else totalMinus += Number(amtValue||0);
        });

        const dayId = 'day_' + dStr.replace(/-/g, '') + '_' + typeFilter;
        let tabLabel = tabNameMap[typeFilter] || '내역';
        
        let amtStrArr = [];
        if (totalPlus > 0) amtStrArr.push('+' + fmt(totalPlus));
        if (totalMinus > 0) amtStrArr.push('-' + fmt(totalMinus));
        let amtStr = amtStrArr.join(' / ') + ' USDT';
        if (totalPlus === 0 && totalMinus === 0) amtStr = '0 USDT';
        
        let colorClass = (totalPlus > 0 && totalMinus === 0) ? 'plus' : ((totalMinus > 0 && totalPlus === 0) ? 'minus' : '');

        html += `
        <div class="tx-day-group" style="margin-bottom: 12px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--bg2);">
            <div class="tx-day-header" onclick="document.getElementById('${dayId}').style.display = document.getElementById('${dayId}').style.display === 'none' ? 'block' : 'none'" style="padding: 16px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 13px; color: var(--text2); margin-bottom: 4px;">${dStr}</div>
                    <div style="font-weight: bold; font-size: 15px; color: var(--text);">
                        ${tabLabel} 총 ${dayTxs.length}건
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="tx-amount ${colorClass}" style="font-size: 16px; margin-bottom: 4px; font-weight: bold;">
                        ${amtStr}
                    </div>
                    <div style="color: var(--text2); font-size: 11px;"><i class="fas fa-chevron-down"></i> 상세 보기</div>
                </div>
            </div>
            <div id="${dayId}" style="display: none; padding: 4px 8px 8px 8px; background: var(--bg); ">
                ${dayTxs.map(renderItem).join('')}
            </div>
        </div>
        `;
    }

    listEl.innerHTML = html;

    
  } catch (err) {
    console.error('loadTxHistory error:', err);
    if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><br>' + (t('emptyTx') || '거래 내역이 없습니다') + '</div>';
  }
}

window.currentTxTab = 'deposit';
window.switchTxTab = function(type, el) {
  window.currentTxTab = type;
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    // If no el provided, try to find it
    const tabs = document.querySelectorAll('.tx-tab');
    for(let t of tabs) {
      if(t.getAttribute('onclick').includes(type)) {
        t.classList.add('active');
        break;
      }
    }
  }
  loadTxHistory(type);
};

// ══════════════════════════════════════════════════════════════════

// 탭 전환
window.switchDepTab = function(tab) {
  const isWallet = tab === 'wallet';
  document.getElementById('depPanelWallet').style.display = isWallet ? '' : 'none';
  document.getElementById('depPanelManual').style.display = isWallet ? 'none' : '';
  document.getElementById('depManualSubmitBtn').style.display = isWallet ? 'none' : '';

  const btnW = document.getElementById('depTabWallet');
  const btnM = document.getElementById('depTabManual');
  if (isWallet) {
    btnW.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)'; btnW.style.color = '#fff';
    btnM.style.background = 'transparent'; btnM.style.color = '#64748b';
  } else {
    btnM.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)'; btnM.style.color = '#fff';
    btnW.style.background = 'transparent'; btnW.style.color = '#64748b';
    loadCompanyWallet();
  }
};

// 빠른 금액 설정
window.setDepAmount = function(amt) {
  const el = document.getElementById('depWalletAmount');
  if (el) { el.value = amt; updateDepWalletFee(amt); }
};

// 수수료 안내 업데이트
window.updateDepWalletFee = function(val) {
  const amt = parseFloat(val) || 0;
  const el  = document.getElementById('depWalletFeeNote');
  if (el && amt > 0) {
    el.textContent = `전송 금액 $${amt.toFixed(2)} USDT + 네트워크 수수료 ~$0.001`;
  }
};

// 지갑 연결
window.connectSolanaWallet = async function() {
  const btn = document.getElementById('btnConnectWallet');
  btn.disabled = true; btn.textContent = '연결 중...';
  try {
    // solana-wallet.js 의 SolanaWallet 사용
    const sw = window.SolanaWallet;
    if (!sw) throw new Error('지갑 모듈 로딩 중입니다. 잠시 후 다시 시도해주세요.');

    const { address, walletName } = await sw.connect();

    // UI 업데이트
    document.getElementById('depWalletConnect').style.display    = 'none';
    document.getElementById('depWalletConnected').style.display  = '';
    document.getElementById('depWalletName').textContent         = `✅ ${walletName} 연결됨`;
    document.getElementById('depWalletAddr').textContent         = address;

    // USDT 잔액 조회
    document.getElementById('depWalletBalance').textContent = '조회중...';
    const balance = await sw.getUsdtBalance(address);
    document.getElementById('depWalletBalance').textContent = `$${balance.toFixed(2)} USDT`;

  } catch (e) {
    if (e.message === 'NO_WALLET') {
      _showNoWalletModal('연결');
    } else if (e.message === 'USER_REJECTED') {
      showToast('연결을 취소했습니다.', 'warning');
    } else if (e.message === 'MOBILE_DEEPLINK') {
      showToast('앱으로 이동합니다...', 'info');
    } else {
      showToast('❌ ' + e.message, 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; } btn.innerHTML = '<span style="font-size:20px;">👻</span> Phantom / 지갑 연결';
  }
};

// 지갑 연결 해제
window.disconnectSolanaWallet = async function() {
  await window.SolanaWallet?.disconnect();
  document.getElementById('depWalletConnect').style.display   = '';
  document.getElementById('depWalletConnected').style.display = 'none';
  document.getElementById('depWalletStatus').style.display    = 'none';
};

// 지갑으로 즉시 전송
window.doWalletDeposit = async function() {
  const sw     = window.SolanaWallet;
  const amount = parseFloat(document.getElementById('depWalletAmount')?.value || 0);

  if (!sw?.publicKey) { showToast('먼저 지갑을 연결하세요.', 'warning'); return; }
  if (!amount || amount < 1) { showToast('최소 입금액은 $1 USDT입니다.', 'warning'); return; }

  // 회사 지갑 주소 가져오기
  let toAddress = '';
  try {
    const r = await window.api.getCompanyWallets();
    if (r.success) {
      const w = (r.data || []).find(w => w.address);
      toAddress = w?.address || '';
    }
  } catch {}
  if (!toAddress) { showToast('❌ 회사 지갑 주소가 설정되지 않았습니다.', 'error'); return; }

  const btn    = document.getElementById('btnWalletSend');
  const status = document.getElementById('depWalletStatus');

  const setStatus = (msg, color = '#6366f1') => {
    status.style.display     = '';
    status.style.background  = color + '15';
    status.style.border      = `1.5px solid ${color}40`;
    status.style.color       = color;
    status.textContent       = msg;
  };

  btn.disabled = true; btn.textContent = '⏳ 처리 중...';

  try {
    // ── Step 1: 서명 + 브로드캐스트
    setStatus('🔐 지갑 서명 요청 중... (지갑 팝업을 확인하세요)', '#6366f1');
    const signature = await sw.sendUsdt(toAddress, amount);

    // ── Step 2: Firestore 저장 + 온체인 자동 검증
    setStatus('📡 온체인 확인 중... (최대 30초 소요)', '#f59e0b');
    const r = await window.api.submitWalletDeposit(
      currentUser.uid, currentUser.email,
      amount, signature,
      sw.publicKey, toAddress
    );

    if (r.success) {
      if (r.data.autoApproved) {
        setStatus('✅ 입금 완료! 잔액이 자동으로 업데이트되었습니다.', '#16a34a');
        showToast(`✅ $${amount} USDT 입금 완료!`, 'success');
        setTimeout(() => { closeModal('depositModal'); refreshWallet?.(); }, 2500);
      } else {
        setStatus(`⏳ 전송 완료! 관리자 확인 후 승인됩니다.\n해시: ${signature.slice(0,16)}...`, '#f59e0b');
        showToast('전송 완료! 관리자 확인 후 승인됩니다.', 'info');
      }
    } else {
      setStatus('❌ ' + r.error, '#dc2626');
      showToast('❌ ' + r.error, 'error');
    }
  } catch (e) {
    if (e.message === 'USER_REJECTED') {
      setStatus('서명을 취소했습니다.', '#64748b');
      showToast('서명을 취소했습니다.', 'warning');
    } else if (e.message === 'WALLET_NOT_CONNECTED') {
      setStatus('지갑 연결이 끊겼습니다. 다시 연결해주세요.', '#dc2626');
    } else if (e.message?.includes('insufficient')) {
      setStatus('❌ USDT 또는 SOL 잔액이 부족합니다.', '#dc2626');
      showToast('❌ 잔액이 부족합니다 (USDT 또는 수수료용 SOL 확인)', 'error');
    } else {
      setStatus('❌ ' + (e.message || '전송 실패'), '#dc2626');
      showToast('❌ ' + e.message, 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; } btn.innerHTML = '🚀 지갑으로 즉시 전송';
  }
};

// ══════════════════════════════════════════════════════════════
// DDRA 토큰 지갑 등록
// ══════════════════════════════════════════════════════════════
window.handleAddDdraToken = async function() {
  const btn     = document.getElementById('addDdraTokenBtn');
  const btnIcon = document.getElementById('addDdraTokenBtnIcon');
  const btnText = document.getElementById('addDdraTokenBtnText');

  if (!window.DDRATokenRegister) {
    showToast('❌ 지갑 모듈을 불러오지 못했습니다', 'error'); return;
  }

  // 감지된 지갑 안내
  const guide = window.DDRATokenRegister.getWalletGuide();

  if (!guide) {
    // 지갑 없음 → 설치 안내 모달
    _showNoWalletModal('DDRA 추가');
    return;
  }

  // 버튼 로딩 상태
  if (btn) { btn.disabled = true; }
  if (btnIcon) btnIcon.textContent = '⏳';
  if (btnText) btnText.textContent = `${guide.name} 에 추가 중...`;

  try {
    const result = await window.DDRATokenRegister.addToWallet();

    if (result.success) {
      if (btnIcon) btnIcon.textContent = '✅';
      if (btnText) btnText.textContent = `${guide.name} 에 DDRA 추가 완료!`;
      showToast(`✅ ${guide.name} 에 DDRA 토큰이 추가되었습니다!`, 'success');
      // 3초 후 원래 버튼으로 복원
      setTimeout(() => {
        if (btnIcon) btnIcon.textContent = '➕';
        if (btnText) btnText.textContent = '내 지갑에 DDRA 추가';
        if (btn) if (btn) { btn.disabled = false; }
      }, 3000);
    } else {
      if (btnIcon) btnIcon.textContent = '➕';
      if (btnText) btnText.textContent = '내 지갑에 DDRA 추가';
      if (btn) if (btn) { btn.disabled = false; }

      if (result.error === 'USER_REJECTED') {
        showToast('취소되었습니다', 'info');
      } else if (result.error === 'NO_MINT' || result.error === 'NO_CONTRACT') {
        _showAddDdraManualModal(result);
      } else if (result.error === 'NOT_SUPPORTED') {
        _showAddDdraManualModal(result);
      } else {
        showToast('❌ ' + (result.message || '토큰 추가 실패'), 'error');
      }
    }
  } catch(e) {
    if (btnIcon) btnIcon.textContent = '➕';
    if (btnText) btnText.textContent = '내 지갑에 DDRA 추가';
    if (btn) if (btn) { btn.disabled = false; }
    showToast('❌ 오류: ' + e.message, 'error');
  }
};

// 지갑 미설치 안내 모달

// ==== 지갑 설치 안내 모달 ====
function _showNoWalletModal(purpose = 'DDRA 추가') {
  // OS 감지
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  let os = 'unknown';
  if (/android/i.test(ua)) os = 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) os = 'ios';

  // 링크 설정
  let phantomLink = 'https://phantom.app/';
  let tpLink = 'https://www.tokenpocket.pro/';
  let tpDesc = 'Solana · BSC · EVM 멀티체인 지원';
  let phantomDesc = 'Solana 전용 · 모바일/PC 지원';

  if (os === 'android') {
    phantomLink = 'https://play.google.com/store/apps/details?id=app.phantom';
    phantomDesc = 'Google Play 다운로드';
    tpLink = 'https://play.google.com/store/apps/details?id=vip.mytokenpocket';
    tpDesc = 'Google Play 다운로드';
  } else if (os === 'ios') {
    phantomLink = 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977';
    phantomDesc = 'App Store 다운로드';
    tpLink = 'https://apps.apple.com/app/tokenpocket-crypto-defi-wallet/id1436028697';
    tpDesc = 'App Store 다운로드';
  }

  const titleText = purpose === '연결' ? '🔗 지갑 연결 필요' : '🔗 지갑 설치 필요';
  const descText = purpose === '연결' 
    ? '입금을 진행하려면 지원하는 지갑이 설치되어 있어야 합니다'
    : 'DDRA 토큰을 추가하려면 지원하는 지갑이 필요합니다';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:3000;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#1a1a2e;border-radius:24px 24px 0 0;padding:28px 24px 36px;width:100%;max-width:430px;box-shadow:0 -8px 40px rgba(0,0,0,.4);">
      <div style="width:40px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 20px;"></div>
      <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;">${titleText}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:22px;">${descText}</div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
        <a href="${phantomLink}" target="_blank"
          style="display:flex;align-items:center;gap:14px;background:rgba(171,159,242,.15);border:1px solid rgba(171,159,242,.3);border-radius:14px;padding:14px 16px;text-decoration:none;">
          <span style="font-size:28px;">👻</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:#ab9ff2;">Phantom Wallet</div>
            <div style="font-size:11px;color:rgba(255,255,255,.5);">${phantomDesc}</div>
          </div>
          <span style="margin-left:auto;font-size:12px;color:rgba(255,255,255,.4);">${os !== 'unknown' ? '다운로드 →' : '설치 →'}</span>
        </a>
        <a href="${tpLink}" target="_blank"
          style="display:flex;align-items:center;gap:14px;background:rgba(41,128,254,.15);border:1px solid rgba(41,128,254,.3);border-radius:14px;padding:14px 16px;text-decoration:none;">
          <span style="font-size:28px;">💼</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:#2980fe;">TokenPocket Wallet</div>
            <div style="font-size:11px;color:rgba(255,255,255,.5);">${tpDesc}</div>
          </div>
          <span style="margin-left:auto;font-size:12px;color:rgba(255,255,255,.4);">${os !== 'unknown' ? '다운로드 →' : '설치 →'}</span>
        </a>
      </div>
      <button onclick="this.closest('[style*=\'position:fixed\']').remove()"
        style="width:100%;padding:14px;background:rgba(255,255,255,.08);border:none;border-radius:12px;color:rgba(255,255,255,.7);font-size:14px;font-weight:600;cursor:pointer;">닫기</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function _showAddDdraManualModal(result) {
  const reg = window.DDRATokenRegister;
  const solanaMint  = reg?.config?.solanaMint  || 'ADDRWVJyvNrdHAd2aa8YuVMzRuN4RaxZsemiRZXW2EHu';
  const bscContract = reg?.config?.bscContract || '관리자 설정 대기 중';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:3000;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#1a1a2e;border-radius:24px 24px 0 0;padding:28px 24px 36px;width:100%;max-width:430px;box-shadow:0 -8px 40px rgba(0,0,0,.4);max-height:85vh;overflow-y:auto;">
      <div style="width:40px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 20px;"></div>
      <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:6px;">🪙 DDRA 토큰 수동 추가</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:20px;">아래 주소를 지갑에 직접 입력해 DDRA를 추가하세요</div>

      <!-- Solana (Phantom / TokenPocket Solana) -->
      <div style="background:rgba(153,69,255,.12);border:1px solid rgba(153,69,255,.3);border-radius:14px;padding:14px 16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">👻</span>
          <span style="font-size:13px;font-weight:700;color:#c084fc;">Phantom / TokenPocket (Solana)</span>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);margin-bottom:4px;">SPL 토큰 민트 주소</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <code id="solanaMintAddr" style="flex:1;font-size:11px;color:#e2e8f0;background:rgba(0,0,0,.3);border-radius:8px;padding:8px 10px;word-break:break-all;font-family:monospace;">${solanaMint}</code>
          <button onclick="navigator.clipboard.writeText('${solanaMint}').then(()=>showToast('✅ 복사됨','success'))"
            style="flex-shrink:0;padding:8px 10px;background:rgba(153,69,255,.25);border:none;border-radius:8px;color:#c084fc;font-size:12px;cursor:pointer;font-weight:700;">복사</button>
        </div>
      </div>

      <!-- BSC (TokenPocket EVM / MetaMask) -->
      <div style="background:rgba(41,128,254,.12);border:1px solid rgba(41,128,254,.3);border-radius:14px;padding:14px 16px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">💼</span>
          <span style="font-size:13px;font-weight:700;color:#60a5fa;">TokenPocket / MetaMask (BSC)</span>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);margin-bottom:4px;">BEP-20 컨트랙트 주소</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <code id="bscContractAddr" style="flex:1;font-size:11px;color:#e2e8f0;background:rgba(0,0,0,.3);border-radius:8px;padding:8px 10px;word-break:break-all;font-family:monospace;">${bscContract}</code>
          <button onclick="navigator.clipboard.writeText('${bscContract}').then(()=>showToast('✅ 복사됨','success'))"
            style="flex-shrink:0;padding:8px 10px;background:rgba(41,128,254,.25);border:none;border-radius:8px;color:#60a5fa;font-size:12px;cursor:pointer;font-weight:700;">복사</button>
        </div>
      </div>

      <button onclick="this.closest('[style*=\"position:fixed\"]').remove()"
        style="width:100%;padding:14px;background:rgba(255,255,255,.08);border:none;border-radius:12px;color:rgba(255,255,255,.7);font-size:14px;font-weight:600;cursor:pointer;">닫기</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

window.showDepositModal = function() {
  loadCompanyWallet();
  // 상태 초기화
  const st = document.getElementById('depWalletStatus');
  if (st) st.style.display = 'none';
  const amtEl = document.getElementById('depWalletAmount');
  if (amtEl) amtEl.value = '';

  // 지갑이 이미 연결되어 있으면 wallet 탭, 아니면 manual 탭이 기본
  const sw = window.SolanaWallet;
  if (sw && sw.publicKey) {
    switchDepTab('wallet');
    // 연결된 지갑 상태 복원
    const connectDiv    = document.getElementById('depWalletConnect');
    const connectedDiv  = document.getElementById('depWalletConnected');
    const nameEl        = document.getElementById('depWalletName');
    const addrEl        = document.getElementById('depWalletAddr');
    if (connectDiv)   connectDiv.style.display   = 'none';
    if (connectedDiv) connectedDiv.style.display = '';
    if (nameEl)       nameEl.textContent         = `✅ ${sw.walletName} 연결됨`;
    if (addrEl)       addrEl.textContent         = sw.publicKey;
    // USDT 잔액 갱신
    const balEl = document.getElementById('depWalletBalance');
    if (balEl) {
      balEl.textContent = '조회중...';
      sw.getUsdtBalance(sw.publicKey).then(bal => {
        balEl.textContent = `$${bal.toFixed(2)} USDT`;
      });
    }
  } else {
    switchDepTab('manual');
  }

  document.getElementById('depositModal').classList.remove('hidden');
};

async function loadCompanyWallet() {
  try {
    const { doc, getDoc, db } = window.FB;
    // Check new structure first
    const snapNew = await getDoc(doc(db, 'settings', 'companyWallets'));
    const addr = document.getElementById('companyWalletAddr');
    if (!addr) return;
    
    if (snapNew.exists() && snapNew.data().wallets && snapNew.data().wallets.length > 0) {
      addr.textContent = snapNew.data().wallets[0].address || '주소 미설정 (관리자 문의)';
      return;
    }
    
    // Fallback to old structure if not found
    const snapOld = await getDoc(doc(db, 'settings', 'wallets'));
    if (snapOld.exists()) {
      addr.textContent = snapOld.data().trc20 || snapOld.data().solana || '주소 미설정 (관리자 문의)';
    } else {
      addr.textContent = '주소 미설정 (관리자 문의)';
    }
  } catch(e) {
    console.error('loadCompanyWallet error:', e);
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

  const btn = window.event ? (window.event.currentTarget || window.event.target) : null;
  const origTxt = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '처리중...'; }

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'transactions'), {
      userId: currentUser.uid, userEmail: currentUser.email || null,
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
    if (btn) { btn.disabled = false; } btn.textContent = t('btnSubmitDeposit');
  }
};

// ===== 출금 신청 =====
window.showWithdrawModal = function() {
  const bonus = walletData?.bonusBalance || 0;
  
  if (currentUser && currentUser.uid) {
      let saved = JSON.parse(localStorage.getItem('savedAddresses_' + currentUser.uid) || '[]');
      
      // DB에 등록된 솔라나 지갑 주소가 있으면 그것을 최우선으로 사용
      const dbWallet = userData?.solanaWallet;
      if (dbWallet && !saved.includes(dbWallet)) {
          saved.unshift(dbWallet); // 최우선 옵션으로 추가
      }
      
      const dataList = document.getElementById('savedAddresses');
      if (dataList) {
          dataList.innerHTML = saved.map(addr => `<option value="${addr}">${addr === dbWallet ? '등록된 지갑' : ''}</option>`).join('');
      }
      
      const addrInput = document.getElementById('withdrawAddress');
      if (addrInput) {
          // DB에 등록된 주소가 있으면 자동으로 입력
          if (dbWallet) {
              addrInput.value = dbWallet;
          } else if (!addrInput.value && saved.length > 0) {
              addrInput.value = saved[0];
          }
      }
  }
  const bonusDdra = bonus / (deedraPrice || 0.5);  // DDRA 환산
  // 출금 가능 USDT 표시
  const avEl = document.getElementById('withdrawAvailable');
  if (avEl) avEl.textContent = fmt(bonus);
  // DDRA 환산 부제목
  const avDdraEl = document.getElementById('withdrawAvailableDdra');
  if (avDdraEl) avDdraEl.textContent = '≈ ' + fmt(bonusDdra) + ' DDRA';
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
  const usdtAmt = parseFloat(amtEl?.value || '0') || 0;
  const price = deedraPrice || 0.5;
  if (usdtAmt > 0 && price > 0) {
    const ddrAmt = usdtAmt / price;
    calcEl.textContent = `예상 지급 수량: ${fmt(ddrAmt)} DDRA (1 DDRA = ${price.toFixed(4)} USDT)`;
    calcEl.style.color = '#f59e0b';
  } else {
    calcEl.textContent = `예상 지급 수량: 0.00 DDRA (1 DDRA = ${price.toFixed(4)} USDT)`;
    calcEl.style.color = '#94a3b8';
  }
}


// ===== 재투자 기능 =====
window.showReinvestModal = async function() {
  const bonus = walletData?.bonusBalance || 0;
  const maxEl = document.getElementById('reinvestMaxAmount');
  if (maxEl) maxEl.innerHTML = fmt(bonus) + ' <span style="font-size:14px;">USDT</span>';
  document.getElementById('reinvestInputAmount').value = '';
  
  // Populate Product Select
  const sel = document.getElementById('reinvestProductSelect');
  if (sel) {
    if (!productsCache || !productsCache.length) {
      try {
        const { collection, getDocs, db } = window.FB;
        const snap = await getDocs(collection(db, 'products'));
        const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        productsCache = allDocs
          .filter(p => (!p.type || p.type === 'investment') && p.isActive !== false)
          .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));
      } catch(e) { console.error('Failed to load products for reinvest', e); }
    }
    
    sel.innerHTML = '<option value="">상품 선택 (기간 / 데일리 이율)</option>';
    if (productsCache && productsCache.length) {
      productsCache.forEach(p => {
        const roi = p.roiPercent != null ? p.roiPercent : (p.dailyRoi != null ? p.dailyRoi : 0);
        const days = p.durationDays != null ? p.durationDays : (p.duration != null ? p.duration : 0);
        sel.innerHTML += `<option value="${p.id}">${p.name} (${roi}% / ${days}일)</option>`;
      });
      // Auto-select first item if exists
      if (productsCache.length > 0) sel.value = productsCache[0].id;
    } else {
      sel.innerHTML = '<option value="">진행 가능한 상품이 없습니다</option>';
    }
  }

  document.getElementById('reinvestModal').classList.remove('hidden');
};

window.setReinvestPercent = function(pct) {
  const bonus = walletData?.bonusBalance || 0;
  let amt = bonus * (pct / 100);
  if (pct === 100) amt = bonus;
  document.getElementById('reinvestInputAmount').value = Math.floor(amt * 100) / 100;
};

window.submitReinvest = async function() {
  const inputAmt = parseFloat(document.getElementById('reinvestInputAmount').value);
  if (!inputAmt || inputAmt <= 0) { showToast('금액을 입력하세요.', 'warning'); return; }
  const bonus = walletData?.bonusBalance || 0;
  if (inputAmt > bonus) { showToast('출금 가능 수익금이 부족합니다.', 'warning'); return; }

  const sel = document.getElementById('reinvestProductSelect');
  if (!sel || !sel.value) { showToast('재투자할 상품을 선택해 주세요.', 'warning'); return; }
  
  const selectedProduct = productsCache.find(p => p.id === sel.value);
  if (!selectedProduct) { showToast('상품 정보를 찾을 수 없습니다.', 'error'); return; }
  
  if (inputAmt < (selectedProduct.minAmount || selectedProduct.minAmt || 0)) { 
      showToast('최소 투자 금액은 ' + (selectedProduct.minAmount || selectedProduct.minAmt) + ' USDT 입니다.', 'warning'); 
      return; 
  }

  const btn = document.getElementById('btnSubmitReinvest');
  const originalText = btn ? btn.textContent : '재투자 승인';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '처리중...';
  }

  try {
    const { doc, writeBatch, increment, serverTimestamp, collection, db } = window.FB;
    const batch = writeBatch(db);
    
    // 1) 지갑 업데이트 (bonusBalance 차감, totalInvest 증가) - usdtBalance는 건드리지 않음
    const walletRef = doc(db, 'wallets', currentUser.uid);
    batch.update(walletRef, {
      bonusBalance: increment(-inputAmt),
      totalInvest: increment(inputAmt)
    });
    const userRef = doc(db, 'users', currentUser.uid);
    batch.update(userRef, {
      totalInvested: increment(inputAmt)
    });

    // 2) 신규 투자 상품 도큐먼트 생성
    const startDate = new Date();
    const days = selectedProduct.durationDays != null ? selectedProduct.durationDays : (selectedProduct.duration || 0);
    const roi = selectedProduct.roiPercent != null ? selectedProduct.roiPercent : (selectedProduct.dailyRoi || 0);
    const endDate = new Date(startDate.getTime() + days * 86400000);
    const expectedReturn = (inputAmt * roi / 100);

    const invRef = doc(collection(db, 'investments'));
    batch.set(invRef, {
      userId: currentUser.uid, 
      productId: selectedProduct.id,
      productName: selectedProduct.name, 
      amount: inputAmt,
      roiPercent: roi, 
      durationDays: days,
      expectedReturn, 
      status: 'active',
      startDate: serverTimestamp(), 
      endDate,
      createdAt: serverTimestamp(),
      isReinvest: true // 재투자 마킹
    });

    // 3) 트랜잭션 기록 (Reinvest -> Invest)
    const txRef = doc(collection(db, 'transactions'));
    batch.set(txRef, {
      userId: currentUser.uid,
      type: 'invest',
      amount: inputAmt,
      currency: 'USDT',
      status: 'active',
      reason: '수익금 재투자 (FREEZE 가입: ' + selectedProduct.name + ')',
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // Firestore onSnapshot이 실시간으로 잔액을 업데이트하므로 수동 차감을 제거합니다.
    
    closeModal('reinvestModal');
    showToast('수익금 재투자가 완료되었습니다!', 'success');
    updateWalletUI();
    if (typeof loadRecentTransactions === 'function') loadRecentTransactions();
    if (typeof loadMyInvestments === 'function') loadMyInvestments();
    if (typeof loadTxHistory === 'function') loadTxHistory('all');
  } catch (err) {
    console.error('Reinvest Error:', err);
    showToast('재투자 처리 중 오류가 발생했습니다: ' + err.message, 'error');
  } finally {
    if (btn) {
      if (btn) { btn.disabled = false; }
      btn.textContent = originalText;
    }
  }
};


function checkWithdrawTime(settings) {
    if (!settings) return { allowed: true };
    const now = new Date();
    const day = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const isWeekend = (day === 0 || day === 6);
    
    // Default to always allowed if not explicitly set
    const allowWeekday = settings.withdrawWeekday !== false; 
    const allowWeekend = settings.withdrawWeekend === true;  
    
    const startTimeStr = settings.withdrawStartTime || '09:00';
    const endTimeStr = settings.withdrawEndTime || '17:00';

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotal = currentH * 60 + currentM;
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    let isAllowedDay = isWeekend ? allowWeekend : allowWeekday;
    let isAllowedTime = currentTotal >= startTotal && currentTotal <= endTotal;

    if (isAllowedDay && isAllowedTime) {
        return { allowed: true };
    }

    let nextDay = new Date(now);

    // Check if it's the same day but earlier
    if (isAllowedDay && currentTotal < startTotal) {
        const msg = (t('errWithdrawTimeToday') || '지금은 출금 가능 시간이 아닙니다.\n오늘 {time} 부터 출금 가능합니다.').replace('{time}', startTimeStr);
        return { allowed: false, message: msg };
    }

    // Look for the next available day
    for (let i = 1; i <= 7; i++) {
        nextDay.setDate(now.getDate() + i);
        let nDay = nextDay.getDay();
        let nIsWeekend = (nDay === 0 || nDay === 6);
        let nAllowed = nIsWeekend ? allowWeekend : allowWeekday;
        if (nAllowed) {
            const daysOfWeek = [
                t('daySun')||'일', t('dayMon')||'월', t('dayTue')||'화', 
                t('dayWed')||'수', t('dayThu')||'목', t('dayFri')||'금', t('daySat')||'토'
            ];
            let dayStr = '';
            if (i === 1) dayStr = t('dayTomorrow') || '내일';
            else if (i === 2) dayStr = t('dayDayAfter') || '모레';
            else dayStr = (t('dayNextWeek') || '다음 주 {day}요일').replace('{day}', daysOfWeek[nDay]);
            
            const msg = (t('errWithdrawTime') || '지금은 출금 가능 시간이 아닙니다.\n{day} {time} 부터 출금 가능합니다.')
                .replace('{day}', dayStr)
                .replace('{time}', startTimeStr);
                
            return { allowed: false, message: msg };
        }
    }
    return { allowed: false, message: t('errWithdrawRestricted') || '현재 출금이 제한되어 있습니다.' };
}

window.submitWithdraw = async function() {
  const { doc, getDoc, db } = window.FB;
  let settings = {};
  try {
      const sysSnap = await getDoc(doc(db, 'settings', 'system'));
      if (sysSnap.exists()) settings = sysSnap.data();
  } catch(e) {}
  
  const timeCheck = checkWithdrawTime(settings);
  if (!timeCheck.allowed) {
      showToast(timeCheck.message, 'error');
      return;
  }

  // 입력값: USDT 수량
  const amountUsdt = parseFloat(document.getElementById('withdrawAmount').value);
  const address = document.getElementById('withdrawAddress').value.trim();
  const pin = document.getElementById('withdrawPin').value.trim();

  if (!amountUsdt || amountUsdt <= 0) { showToast('출금할 금액을 입력하세요', 'warning'); return; }
  if (!address) { showToast(t('toastEnterWithAddr'), 'warning'); return; }
  if (!pin || pin.length !== 6) { showToast(t('toastEnterPin'), 'warning'); return; }
  if (!/^\d{6}$/.test(pin)) { showToast('PIN은 숫자 6자리여야 합니다.', 'warning'); return; }

  if (currentUser && currentUser.uid) {
      let saved = JSON.parse(localStorage.getItem('savedAddresses_' + currentUser.uid) || '[]');
      if (!saved.includes(address)) {
          saved.unshift(address);
          if (saved.length > 5) saved = saved.slice(0, 5);
          localStorage.setItem('savedAddresses_' + currentUser.uid, JSON.stringify(saved));
      } else {
          saved = saved.filter(a => a !== address);
          saved.unshift(address);
          localStorage.setItem('savedAddresses_' + currentUser.uid, JSON.stringify(saved));
      }
  }

  // PIN 미설정 시 설정 유도
  if (!userData?.withdrawPin) {
    showToast('출금 PIN이 설정되지 않았습니다. 먼저 PIN을 설정해주세요.', 'warning');
    closeModal('withdrawModal');
    setTimeout(() => showWithdrawPinSetup(), 300);
    return;
  }

  const price = deedraPrice || 0.5;
  const ddrAmt = amountUsdt / price;  // DDRA 환산

  // 출금 가능 금액 = bonusBalance(USDT)
  const availableBonus = walletData?.bonusBalance || 0;
  if (availableBonus < amountUsdt) {
    showToast(`출금 가능 USDT 부족 (가능: ${fmt(availableBonus)} USDT)`, 'error'); return;
  }
  if (userData?.withdrawPin && userData.withdrawPin !== btoa(pin)) { showToast(t('toastWrongPin'), 'error'); return; }

  const btn = window.event ? (window.event.currentTarget || window.event.target) : null;
  if (btn) { btn.disabled = true; } btn.textContent = '처리중...';

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
      userId: currentUser.uid, userEmail: currentUser.email || null,
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

    try {
      // 로컬 walletData 즉시 반영
      if (walletData) {
        walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) - amountUsdt);
        walletData.totalWithdrawal = (walletData.totalWithdrawal || 0) + amountUsdt;
      }
    } catch(e) { console.error('Wallet update error', e); }

    closeModal('withdrawModal');
    const feeMsg = feeAmount > 0 ? ` (${t('fee') || '수수료'} ${fmt(feeAmount)} DDRA)` : '';
    showToast(`${t('toastWithdrawDone2') || '출금 신청 완료!'} (승인 대기 중)`, 'success');
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawAddress').value = '';
    document.getElementById('withdrawPin').value = '';
    // 지갑 UI 갱신
    updateWalletUI();
    if (typeof loadRecentTransactions === 'function') loadRecentTransactions();
    if (typeof loadTxHistory === 'function') { const activeTab = document.querySelector('.tx-tab.active'); loadTxHistory(window.currentTxTab || 'deposit'); }
  } catch (err) {
    showToast(t('failPrefix') + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; } btn.textContent = t('btnSubmitWithdraw');
  }
};

// ===== 투자 페이지 =====
async function loadInvestPage() {
  loadProducts();
  loadMyInvestments();
  loadSimulatorOptions();
}

// ===== 투자 서브탭 전환 =====
window.switchInvestSubTab = function(tab) {
  ['plans','my','earn'].forEach(t => {
    const el = document.getElementById('investSubTab_' + t);
    const btn = document.getElementById('investTab_' + t);
    if (el) el.style.display = (t === tab) ? '' : 'none';
    if (btn) {
      if (t === tab) {
        btn.style.background = 'linear-gradient(135deg,#3b82f6,#6366f1)';
        btn.style.color = '#fff';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text2,#94a3b8)';
      }
    }
  });
  if (tab === 'earn') loadEarnHistoryTab();
};

async function loadProducts() {
  const { collection, getDocs, db } = window.FB;
  const listEl = document.getElementById('productList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item tall"></div><div class="skeleton-item tall"></div>';
  try {
    const snap = await getDocs(collection(db, 'products'));
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('[Products] 전체 상품:', allDocs.length, allDocs.map(p=>({name:p.name,isActive:p.isActive,type:p.type})));
    productsCache = allDocs
      .filter(p => (!p.type || p.type === 'investment') && p.isActive !== false)
      .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));

    if (!productsCache.length) {
      if (listEl) listEl.innerHTML = `<div class="empty-state"><i class="fas fa-snowflake"></i>${t('emptyFreezePlan')}</div>`;
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
            <div class="product-name">${(p.name && p.name.includes('1개월') ? t('productMonth1') : p.name && p.name.includes('3개월') ? t('productMonth3') : p.name && p.name.includes('6개월') ? t('productMonth6') : p.name && p.name.includes('12개월') ? t('productMonth12') : (p.name || '-'))}</div>
            <span class="product-tag ${tag}">${(p.name && p.name.includes('1개월') ? t('productMonth1') : p.name && p.name.includes('3개월') ? t('productMonth3') : p.name && p.name.includes('6개월') ? t('productMonth6') : p.name && p.name.includes('12개월') ? t('productMonth12') : (p.name || '-'))}</span>
          </div>
          <div class="product-roi-block">
            <div class="product-roi">${roi.toFixed(1)}%</div>
            <div class="product-roi-label">${t('dailyRoi') || '일 수익률'}</div>
          </div>
        </div>
        
        <div class="product-graph" style="height:40px; margin: 8px 0 12px; position:relative; opacity:0.8;">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:100%; height:100%; overflow:visible;">
            <defs>
              <linearGradient id="gradLine-${p.id}" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--primary)"/>
                <stop offset="100%" stop-color="${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}"/>
              </linearGradient>
              <linearGradient id="gradFill-${p.id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0,28 Q25,25 50,15 T100,2" fill="none" stroke="url(#gradLine-${p.id})" stroke-width="2" vector-effect="non-scaling-stroke"/>
            <path d="M0,28 Q25,25 50,15 T100,2 L100,30 L0,30 Z" fill="url(#gradFill-${p.id})"/>
            <!-- Add a pulse dot at the end -->
            <circle cx="100" cy="2" r="2.5" fill="${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}">
               <animate attributeName="r" values="2.5; 5; 2.5" dur="2s" repeatCount="indefinite" />
               <animate attributeName="opacity" values="1; 0.3; 1" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
        <div class="product-meta">
          <div class="product-meta-item">${t('periodLabel') || '기간'}: <strong>${parseInt(days)}${t('days') || '일'}</strong></div>
          <div class="product-meta-item">${t('minLabel') || '최소'}: <strong>${fmt(p.minAmount)} USDT</strong></div>
          <div class="product-meta-item">${t('maxLabel') || '최대'}: <strong>${fmt(p.maxAmount)} USDT</strong></div>
        </div>
        <div class="product-conversion">
          ❄️ ${(t('productHint1') || '{min} USDT FREEZE 시 일 수익').replace('{min}', fmt(p.minAmount))} <strong>~${fmt(dailyEarning)} USDT</strong>
          (≈ ${fmt(dailyEarning / (deedraPrice||0.5))} DDRA${t('perDay') || '/일'}) · 🔒 ${t('productHint2') || '만기 후 언프리즈 가능'}
        </div>
        <button class="invest-btn" onclick="openInvestModal('${p.id}','${p.name || ''}',${roi},${days},${p.minAmount||0},${p.maxAmount||9999})">
          ❄️ FREEZE
        </button>
      </div>`;
    }).join('');
  } catch (err) {
    console.warn(err);
    if (listEl) listEl.innerHTML = `<div class="empty-state">${t('loadFail') || '불러오기 실패'}</div>`;
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
        usdtBalance: increment(inv.amount || 0),
        totalInvest: increment(-(inv.amount || 0))
      });
      await batch.commit();

      // 만기 알림 생성
      await addDoc(collection(db, 'notifications'), {
        userId: currentUser.uid,
        type: 'invest',
        title: '✅ FREEZE 만기 완료',
        message: `[${inv.productName}] FREEZE 계약이 만료되었습니다. 원금 ${fmt(inv.amount)} USDT가 지갑에 언프리즈되었습니다.`,
        isRead: false,
        createdAt: serverTimestamp()
      });

      // 로컬 walletData 즉시 반영
      if (walletData) {
        walletData.usdtBalance = (walletData.usdtBalance || 0) + (inv.amount || 0);
        walletData.totalInvest = Math.max(0, (walletData.totalInvest || 0) - (inv.amount || 0));
      }
      console.info(`[AutoComplete] 투자 만기 처리 완료: ${d.id} (${inv.productName}, ${inv.amount} USDT 반환)`);
    } catch(e) { console.warn('[AutoComplete] 만기 처리 실패:', d.id, e); }
  }
  if (expired.length > 0) {
    // 만기 처리 후 지갑 UI 갱신
    updateWalletUI();
    updateHomeUI();
    showToast(`❄️ 만기 FREEZE ${expired.length}건의 원금이 언프리즈되었습니다.`, 'success');
  }
}

async function loadMyInvestments() {
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const listEl = document.getElementById('myInvestList');
  const sumItems = { count: 0, total: 0, returns: 0 };
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';

  try {
    // 단일 where만 사용 → JS에서 active 필터 + 정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    const invests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(inv => inv.status === 'active')
      .sort((a, b) => (b.startDate?.seconds || 0) - (a.startDate?.seconds || 0));

    // 만기 투자 자동 처리
    await autoCompleteExpiredInvestments(snap.docs);

    invests.forEach(inv => {
      sumItems.count++;
      sumItems.total += (inv.amount || inv.amountUsdt || 0);
      sumItems.returns += inv.expectedReturn || 0;
    });

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('activeInvestCount', sumItems.count + '건');
    setEl('totalInvestAmount', '$' + fmt(sumItems.total));
    setEl('expectedReturn', fmt(sumItems.returns) + ' USDT/일');

    if (!invests.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-snowflake"></i>' + (t('emptyActiveFreeze') || '진행 중인 FREEZE가 없습니다') + '</div>';
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
      const amt = inv.amount || inv.amountUsdt || 0;
      const dailyRoiRate = (inv.roiPercent != null ? inv.roiPercent : inv.dailyRoi || 0) / 100;
      const dailyD = amt * dailyRoiRate;
      
      const yyyy = start.getFullYear();
      const mm = String(start.getMonth() + 1).padStart(2, '0');
      const dd = String(start.getDate()).padStart(2, '0');
      const startDateStr = `${yyyy}.${mm}.${dd}`;

      return `

      <div class="invest-item">
        <!-- SVG background accent -->
        <div style="position:absolute; top:0; right:0; opacity:0.04; width:150px; height:100px; pointer-events:none;">
            <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 0L93.3013 25V75L50 100L6.69873 75V25L50 0Z"/>
            </svg>
        </div>
        <div class="invest-item-header" style="position:relative; z-index:1;">
          <span class="invest-item-name" style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:6px;">
             ${inv.productName || 'FREEZE'} <span style="font-size:12px; font-weight:500; color:var(--text2); margin-left:2px;">(${startDateStr})</span>
          </span>
          <span class="invest-item-amount" style="font-size:16px; font-weight:800; color:var(--primary-light);">${fmt(amt)}</span>
        </div>
        <div class="invest-item-detail" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
          <span>${t('dailyReturnLabel')} <strong style="color:var(--green)">+${fmt(dailyD)}</strong> (${(dailyRoiRate*100).toFixed(2)}%${t('perDay')})</span>
          <span>${t('remainDaysLabel').replace('{n}', remainDays)}</span>
        </div>
        <div class="invest-item-detail" style="color:var(--text2);font-size:11px;margin-top:2px;">
          ${t('totalExpectedLabel').replace('{n}', fmt(inv.expectedReturn || 0))}
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
      ${t('simPeriod')}: <strong>${days}${t('unit_days')}</strong> · ${t('minLabel')||'최소'} ${fmt(minAmt)} USDT ~ ${t('maxLabel')||'최대'} ${fmt(maxAmt)} USDT
    </div>`;

  const hintEl = document.getElementById('investAmountHint');
  if (hintEl) hintEl.textContent = `${t('minLabel')||'최소'} ${fmt(minAmt)} USDT ~ ${t('maxLabel')||'최대'} ${fmt(maxAmt)} USDT`;

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

  const btn = window.event ? (window.event.currentTarget || window.event.target) : null;
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
    const userRef = doc(db, 'users', currentUser.uid);
    batch.update(userRef, {
      totalInvested: increment(amount)
    });

    await batch.commit();

    // 로컬 walletData도 즉시 반영 (UI 즉시 업데이트)
    if (walletData) {
      walletData.usdtBalance = (walletData.usdtBalance || 0) - amount;
      walletData.totalInvest = (walletData.totalInvest || 0) + amount;
    }

    // 🔔 자동 규칙: 투자 시작 알림
    try {
      if (window.api && typeof window.api.fireAutoRules === 'function') {
        await window.api.fireAutoRules('investment_start', currentUser.uid, {
          name:        userData?.name || currentUser.email || currentUser.uid,
          amount:      amount.toFixed(2),
          productName: selectedProduct.name || '',
          rank:        userData?.rank || 'G0',
        }, currentUser.uid);
      }
    } catch(_) { /* 자동 규칙 실패 시 투자 처리에 영향 없음 */ }

    closeModal('investModal');
    showToast(t('toastInvestDone'), 'success');
    loadMyInvestments();
    // 지갑 UI 즉시 갱신
    updateWalletUI();
    if (typeof loadRecentTransactions === 'function') loadRecentTransactions();
    if (typeof loadTxHistory === 'function') { const activeTab = document.querySelector('.tx-tab.active'); loadTxHistory(window.currentTxTab || 'deposit'); }
  } catch (err) {
    showToast(t('failPrefix') + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; } btn.textContent = t('btnSubmitInvest');
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

  // Don't overwrite the whole div, just update the image
  const rankImg = document.getElementById('rankCurrentImg');
  const rankNameEl = document.getElementById('rankCurrentName');
  const rankNamesMap = {
    'G0': 'Stone', 'G1': 'Wood', 'G2': 'Bronze', 'G3': 'Silver', 'G4': 'Gold',
    'G5': 'Platinum', 'G6': 'Emerald', 'G7': 'Sapphire', 'G8': 'Diamond',
    'G9': 'White Diamond', 'G10': 'Ultimate'
  };
  if(rankNameEl) {
      rankNameEl.textContent = rankNamesMap[rank] || 'Stone';
  }
  if (rankImg) {
    let r = (rank || 'G0').trim().toLowerCase(); if(!r.match(/^g([0-9]|10)$/)) r = 'g0'; rankImg.src = `/static/ranks/${r}.png?v=2`;
  } else {
    // fallback if img is missing
    const rc = document.getElementById('rankCurrent');
    if (rc) rc.innerHTML = `<img id="rankCurrentImg" src="/static/ranks/${((rank || 'G0').trim().toLowerCase().match(/^g([0-9]|10)$/) ? (rank || 'G0').trim().toLowerCase() : 'g0')}.png?v=2" alt="${rank}" style="width:100px;height:auto;object-fit:contain;" /><div id="rankCurrentName" style="font-size:32px; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px; flex:1;">${rankNamesMap[rank] || 'Stone'}</div>`;
  }

  // ── 새 승진 조건 (관리자 설정) 방식 ──────────────────────────
  if (rankPromoSettings && rankPromoSettings.criteria && nextRankObj) {
    const criteria   = rankPromoSettings.criteria;
    const nextRankId = nextRankObj.rank;
    const crit       = criteria[nextRankId];
    const useBalanced= rankPromoSettings.useBalancedVolume === true;

    if (crit) {
      // 보유 데이터 파싱
      const curSelf     = walletData?.totalDeposit || 0;
      const curMembers  = userData?.totalReferrals || userData?.referralCount || 0;
      // 매출 정보 (없으면 0)
      const curSales    = userData?.networkSales || 0; 
      
      // 균형 매출 계산 (전체 매출 - 최대 라인 매출)
      let maxLegSales = 0;
      if (userData?.legSales && typeof userData.legSales === 'object') {
        const salesValues = Object.values(userData.legSales).map(v => Number(v) || 0);
        if (salesValues.length > 0) {
          maxLegSales = Math.max(...salesValues);
        }
      }
      const calculatedBalanced = Math.max(0, curSales - maxLegSales);
      const curBalanced = userData?.otherLegSales ?? userData?.networkBalancedSales ?? userData?.balancedVolume ?? calculatedBalanced;

      // 필요한 조건들
      const reqSelf     = crit.minSelfInvest || 0;
      const reqMembers  = crit.minNetworkMembers || 0;
      const reqSales    = crit.minNetworkSales || 0;
      const reqBalanced = crit.minBalancedVolume || 0;
      
      const condHtml = [];
      
      // Helper
      const makeBar = (label, cur, req, unit) => {
         const pct = req > 0 ? Math.min(100, (cur / req) * 100) : 100;
         const diff = req - cur;
         const diffMsg = diff > 0 ? `<span style="color:#ef4444;">${diff.toLocaleString()} ${unit} 부족</span>` : `<span style="color:#10b981;">✔ 달성 완료</span>`;
         return `
          <div style="font-size:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="color:var(--text2); font-weight:600;">${label}</span>
              <span style="color:var(--text);"><strong>${cur.toLocaleString()}</strong> / ${req.toLocaleString()} ${unit}</span>
            </div>
            <div class="rank-progress-bar" style="height:6px; background:rgba(150,150,150,0.2); border-radius:3px;">
              <div class="rank-progress-fill" style="width:${pct}%; background:${pct>=100?'#10b981':'var(--primary)'}; border-radius:3px; transition:width 0.5s;"></div>
            </div>
            <div style="text-align:right; font-size:10px; margin-top:3px; font-weight:600;">${diffMsg}</div>
          </div>
         `;
      };

      if (reqSelf > 0) condHtml.push(makeBar('본인 투자금', curSelf, reqSelf, 'USDT'));
      if (useBalanced && reqBalanced > 0) {
         condHtml.push(makeBar('균형 매출 <span style="font-size:10px;font-weight:normal;">(최대 라인 제외)</span>', curBalanced, reqBalanced, 'USDT'));
      } else if (reqSales > 0) {
         condHtml.push(makeBar('산하 매출 합계', curSales, reqSales, 'USDT'));
      }
      if (reqMembers > 0) condHtml.push(makeBar('산하 인원 수', curMembers, reqMembers, '명'));
      
      const container = document.getElementById('nextRankContainer');
      const legacy = document.getElementById('legacyRankInfo');
      if (container) container.style.display = 'block';
      if (legacy) legacy.style.display = 'none';
      
      const hl = document.getElementById('nextRankHighlight');
      if(hl) hl.textContent = `${nextRankId} ${rankNamesMap[nextRankId] || ''}`;
      
      const conds = document.getElementById('nextRankConditions');
      if(conds) conds.innerHTML = condHtml.join('');
      
      return;
    }
  }

  // ── 레거시 방식 (만약 설정이 없을 때 fallback) ─────────────
  const container = document.getElementById('nextRankContainer');
  const legacy = document.getElementById('legacyRankInfo');
  if (container) container.style.display = 'none';
  if (legacy) legacy.style.display = 'block';


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
  const { collection, query, where, getDocs, limit, db } = window.FB;
  const listEl = document.getElementById('referralList');
  const netBonus = document.getElementById('netBonus');
  const netDirect = document.getElementById('netDirectCount');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    // 단일 where만 사용 → JS 정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    const refs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (netDirect) netDirect.textContent = refs.length;
    if (netBonus) netBonus.textContent = fmt(walletData?.totalEarnings || 0);

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('rankReferralCount', refs.length);

    if (!refs.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-user-friends"></i>' + (t('emptyRef') || '추천인이 없습니다') + '</div>';
      return;
    }

    if (listEl) listEl.innerHTML = refs.map(r => {
      const isOnline = r.lastSeenAt && (Date.now() - r.lastSeenAt < 120000);
      const onlineDot = isOnline ? `<div style="position:absolute; bottom:-2px; right:-2px; width:10px; height:10px; background:#10b981; border-radius:50%; border:2px solid #1e1e28; box-shadow: 0 0 4px rgba(16,185,129,0.5);"></div>` : '';
      return `
      <div class="referral-item">
        <div class="ref-avatar" style="position: relative;">
          <i class="fas fa-user"></i>
          ${onlineDot}
        </div>
        <div class="ref-info">
          <div class="ref-name">${r.name || '이름 없음'}</div>
          <div class="ref-date">${fmtDate(r.createdAt)}</div>
        </div>
        <div class="ref-rank">${r.rank || 'G0'}</div>
      </div>`;
    }).join('');

  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}


window.cavePath = [];

async function buildOrgTree() {
  const treeEl = document.getElementById('orgTree');
  if (!treeEl) return;

  // Initialize with root if empty
  if (window.cavePath.length === 0) {
    window.cavePath = [{
      id: currentUser.uid,
      name: userData?.name || '나',
      username: userData?.username || '',
      email: userData?.email || '',
      rank: userData?.rank || 'G0',
      createdAt: userData?.createdAt,
      referralCount: userData?.referralCount || userData?.totalReferrals || 0,
      totalInvested: userData?.totalInvested || 0,
      networkSales: userData?.networkSales || 0,
      otherLegSales: userData?.otherLegSales || 0
    }];
  }

  await renderCaveTree();
}

window.renderCaveTree = async function() {
  const treeEl = document.getElementById('orgTree');
  if (!treeEl) return;
  // Reset transform and makeDraggable state when re-rendering tree
  treeEl.style.transform = 'translate(0px, 0px)';
  const wrap = document.getElementById('orgChartWrap');
  
  

  
  const colorMap = {
    g0: '#4b5563', g1: '#3b82f6', g2: '#10b981', g3: '#059669', g4: '#d97706',
    g5: '#ea580c', g6: '#e11d48', g7: '#dc2626', g8: '#9333ea', g9: '#7c3aed',
    g10: 'linear-gradient(45deg, #fbbf24, #f59e0b, #d97706)'
  };

  const renderNode = (n, isPathNode, pathIndex) => {
    const isMe = n.id === currentUser.uid;
    const cHex = colorMap[(n.rank||'g0').toLowerCase()] || '#4b5563';
    const bg = isMe ? 'linear-gradient(135deg, rgba(157, 78, 221, 0.2), rgba(30, 30, 40, 0.95))' : 'rgba(30, 30, 40, 0.95)';
    const border = isMe ? '2px solid #9d4edd' : `1px solid ${cHex.includes('gradient') ? '#f59e0b' : cHex}`;
    const displayId = n.username || (n.email ? n.email.split('@')[0] : (n.id ? n.id.substring(0, 8).toUpperCase() : '***'));
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayId}&backgroundColor=transparent`;
    const shadow = isPathNode ? '0 0 25px rgba(157, 78, 221, 0.4)' : '0 5px 15px rgba(0,0,0,0.3)';
    const opacity = isPathNode && pathIndex < window.cavePath.length - 1 ? '0.7' : '1';
    const transform = isPathNode && pathIndex < window.cavePath.length - 1 ? 'scale(0.95)' : 'scale(1)';

    // 안읽은 메시지가 있는 사용자(또는 그 하위 조직에 있는 사용자)에게 뱃지 표시
    const hasUnread = window.unreadChatPaths && window.unreadChatPaths.has(n.id) && !isMe;
    const badgeHtml = hasUnread ? `<div style="position:absolute; top:-4px; right:-4px; width:14px; height:14px; background:#ef4444; border-radius:50%; border:2px solid var(--surface); animation: pulse 2s infinite; z-index: 5;"></div>` : '';

    // 온라인 상태 표시 뱃지 (최근 2분 이내 활동)
    const isOnline = n.lastSeenAt && (Date.now() - n.lastSeenAt < 120000);
    const onlineBadge = isOnline ? `<div style="position:absolute; bottom:-2px; right:-2px; width:14px; height:14px; background:#10b981; border-radius:50%; border:2px solid #1e1e28; z-index:5; box-shadow: 0 0 5px rgba(16,185,129,0.5);"></div>` : '';

    let refCount = n.referralCount || n.totalReferrals || 0;
    if (refCount === 0 && n.children && n.children.length > 0) refCount = n.children.length;
    else if (refCount === 0 && n.hasMore) refCount = "1+";
    else if (refCount === 0 && isPathNode && pathIndex < window.cavePath.length - 1) refCount = "1+";
    
    let refBadge = '';
    if (refCount !== 0 && refCount !== '0') {
        refBadge = `<div style="position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); background:#2563eb; color:#fff; font-size:10px; font-weight:bold; padding:2px 8px; border-radius:10px; white-space:nowrap; border:1px solid #1e1e28; z-index:10; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">하위 ${refCount}명</div>`;
    }

    return `
      <div class="org-node-wrap" style="animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; position: relative;">
        ${badgeHtml}
        <div style="background:${bg}; backdrop-filter:blur(10px); border:${border}; border-radius:16px; color:#fff; padding:12px 20px; box-shadow: ${shadow}; display:flex; align-items:center; gap:12px; cursor:pointer; min-width: 240px; opacity:${opacity}; transform:${transform}; transition:all 0.3s;"
             onclick="showNodeActionModal('${n.id}', '${(displayId).replace(/'/g, `\\'`)}', '${n.rank}', ${isPathNode}, ${pathIndex}, '${refCount}')">
           <div style="position: relative; flex-shrink: 0; width:40px; height:40px;">
              <div style="width:100%; height:100%; border-radius:50%; background:rgba(255,255,255,0.1); overflow:hidden;">
                 <img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />
              </div>
              ${onlineBadge}
              ${refBadge}
           </div>
           <div style="display:flex; flex-direction:column; overflow:hidden; text-align:left; width:100%;">
             <div style="font-weight:bold; font-size:14px; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayId}</div>
             <div style="background:${cHex}; color:#fff; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:bold; width:fit-content; line-height:1.2; margin-bottom:8px;">${n.rank||'G0'}</div>
             <div style="font-size:11px; text-align:left; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px; margin-top:2px;">
                 <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#cbd5e1;">
                     <span>본인 매출:</span>
                     <span style="color:#10b981; font-weight:700;">${Number(n.totalInvested || n.lockedBalance || 0).toLocaleString(undefined, {maximumFractionDigits:2})} USDT</span>
                 </div>
                 <div style="display:flex; justify-content:space-between; color:#cbd5e1;">
                     <span>전체 합계:</span>
                     <span style="color:#3b82f6; font-weight:700;">${Number(n.networkSales || n.totalSales || 0).toLocaleString(undefined, {maximumFractionDigits:2})} USDT</span>
                 </div>
             </div>
           </div>
        </div>
      </div>
    `;
  };

  // 1. Render active path
  let html = `<div style="display:flex; flex-direction:column; align-items:center; width:100%;">`;
  
  for (let i = 0; i < window.cavePath.length; i++) {
     html += renderNode(window.cavePath[i], true, i);
     // V-connector to next node or children
     html += `<div style="width:2px; height:30px; background:linear-gradient(to bottom, #9d4edd, rgba(157,78,221,0.2)); margin:4px 0; position:relative;"></div>`;
  }

  // Loading spinner for children
  html += `<div id="caveChildrenWrap" style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; max-width:100%; padding:10px;">
              <div class="spinner" style="margin:20px;"></div>
           </div>`;
  
  html += `</div>`;
  treeEl.innerHTML = html;
  if (wrap) { try { window.makeDraggableMap(wrap, treeEl); } catch(e) { console.error(e); } }
  
  

  // 2. Fetch children for the last node in path
  const lastNode = window.cavePath[window.cavePath.length - 1];

  // --- Rank-based Depth Restriction (Removed as per request) ---
  const getMaxDepth = (rank) => {
     return 999; // 무조건 하부조직 제한 없이 열람 가능하도록 수정
  };
  
  const userRank = userData?.rank || 'G0';
  const maxDepth = getMaxDepth(userRank);
  const currentDepthToFetch = window.cavePath.length; // path length 1 fetches depth 1
  
  if (currentDepthToFetch > maxDepth) {
     const childrenWrap = document.getElementById('caveChildrenWrap');
     if (childrenWrap) {
        childrenWrap.innerHTML = `
           <div style="background:rgba(20,20,30,0.8); border:1px solid rgba(157,78,221,0.3); border-radius:16px; padding:24px 30px; text-align:center; max-width:85%; box-shadow:0 10px 30px rgba(0,0,0,0.5); backdrop-filter:blur(5px); animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
             <div style="font-size:36px; margin-bottom:12px; filter:drop-shadow(0 0 10px rgba(245,158,11,0.5));">🔒</div>
             <div style="color:#f59e0b; font-weight:800; font-size:16px; margin-bottom:8px; letter-spacing:0.5px;">${t('orgDepthLimitTitle')}</div>
             <div style="color:#cbd5e1; font-size:13px; line-height:1.6;">
                ${t('orgDepthLimitDesc').replace('{rank}', userRank).replace('{depth}', maxDepth)}
             </div>
           </div>
        `;
     }
     return;
  }
  // -------------------------------------

  try {
    const availableDepth = Math.max(1, maxDepth - window.cavePath.length + 1);
    const fetchDepth = Math.min(10, availableDepth); // 10 depths max at once
    
    let children = [];
    const { collection, query, where, getDocs, limit, db } = window.FB;
    
    // Level 1
    const q1 = query(collection(db, 'users'), where('referredBy', '==', lastNode.id));
    const snap1 = await getDocs(q1);
    children = snap1.docs.map(d => ({ id: d.id, ...d.data(), children: [], hasMore: false }));
    
    if (fetchDepth >= 2 && children.length > 0) {
        await Promise.all(children.map(async p1 => {
            const q2 = query(collection(db, 'users'), where('referredBy', '==', p1.id));
            const s2 = await getDocs(q2);
            p1.children = s2.docs.map(d => ({ id: d.id, ...d.data(), children: [], hasMore: false }));
            
            if (fetchDepth >= 3 && p1.children.length > 0) {
                await Promise.all(p1.children.map(async p2 => {
                    const q3 = query(collection(db, 'users'), where('referredBy', '==', p2.id));
                    const s3 = await getDocs(q3);
                    p2.children = s3.docs.map(d => ({ id: d.id, ...d.data(), children: [], hasMore: false }));
                    
                    // check hasMore for level 3
                    if (p2.children.length > 0) {
                        await Promise.all(p2.children.map(async p3 => {
                            const q4 = query(collection(db, 'users'), limit(1), where('referredBy', '==', p3.id));
                            const s4 = await getDocs(q4);
                            p3.hasMore = !s4.empty;
                        }));
                    }
                }));
            } else if (p1.children.length > 0) {
                // check hasMore for level 2
                await Promise.all(p1.children.map(async p2 => {
                    const qt = query(collection(db, 'users'), limit(1), where('referredBy', '==', p2.id));
                    const st = await getDocs(qt);
                    p2.hasMore = !st.empty;
                }));
            }
        }));
    } else if (children.length > 0) {
        // check hasMore for level 1
        await Promise.all(children.map(async p1 => {
            const qt = query(collection(db, 'users'), limit(1), where('referredBy', '==', p1.id));
            const st = await getDocs(qt);
            p1.hasMore = !st.empty;
        }));
    }

    const childrenWrap = document.getElementById('caveChildrenWrap');
    if (!childrenWrap) return;

    if (children.length === 0) {
       childrenWrap.innerHTML = `<div style="color:var(--text3); font-size:13px; text-align:center; padding:20px;">
          ${lastNode.id === currentUser.uid ? t('shareToExpand') : t('noSubMembers')}
       </div>`;
    } else {
       const buildNestedHtml = (nodes, currentDepth) => {
          if (!nodes || nodes.length === 0) return '';
          let html = `<div style="display:flex; justify-content:center; align-items:flex-start; position:relative;">`;
          
          nodes.forEach((n, idx) => {
             html += `<div style="display:flex; flex-direction:column; align-items:center; position:relative; padding:0 8px;">`;
             
             if (nodes.length > 1) {
                 let left = idx === 0 ? '50%' : '0';
                 let width = (idx === 0 || idx === nodes.length - 1) ? '50%' : '100%';
                 html += `<div style="position:absolute; top:0; left:${left}; width:${width}; height:2px; background:rgba(157,78,221,0.5); z-index:0;"></div>`;
             }

             html += `<div style="width:2px; height:24px; background:rgba(157,78,221,0.5); z-index:0;"></div>`;
             
             html += `<div style="z-index:1;">`;
             html += renderNode(n, false, -1);
             html += `</div>`;

             if (n.children && n.children.length > 0) {
                 html += `<div style="width:2px; height:24px; background:rgba(157,78,221,0.5); margin:0; z-index:0;"></div>`;
                 html += buildNestedHtml(n.children, currentDepth + 1);
             } else if (n.hasMore || (n.children && n.children.length > 0)) {
                 const displayId = n.username || (n.email ? n.email.split('@')[0] : (n.id ? n.id.substring(0, 8).toUpperCase() : '***'));
                 html += `<div style="margin-top:12px; font-size:11px; background:rgba(157,78,221,0.2); border:1px solid rgba(157,78,221,0.4); padding:6px 12px; border-radius:12px; color:#e2e8f0; cursor:pointer; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.2); transition:all 0.2s;" onmouseover="this.style.background='rgba(157,78,221,0.4)'" onmouseout="this.style.background='rgba(157,78,221,0.2)'" onclick="showNodeActionModal('${n.id}', '${(displayId).replace(/'/g, `\\'`)}', '${n.rank}', false, -1, '${n.referralCount || n.totalReferrals || 0}')">▼ 더보기 (${n.rank||'G0'})</div>`;
             }
             
             html += `</div>`;
          });
          
          html += `</div>`;
          return html;
       };

       childrenWrap.innerHTML = buildNestedHtml(children, 1);
    }
  
  } catch (err) {
    console.error(err);
    const childrenWrap = document.getElementById('caveChildrenWrap');
    if (childrenWrap) childrenWrap.innerHTML = '<div style="color:#ef4444;font-size:13px;">데이터를 불러오지 못했습니다. (' + err.message + ')</div>';
  }
  
  // 새로 렌더링된 요소가 적절한 위치에 오도록 스크롤 (화면 약간 위쪽으로 포커스)
  
  setTimeout(() => {
    const scroller = document.getElementById('orgChartWrap');
    if (!scroller) return;

    // Focus on the children wrap so the active node and children are visible
    const childrenWrap = document.getElementById('caveChildrenWrap');
    if (childrenWrap) {
        const wrapRect = childrenWrap.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const relativeTop = (wrapRect.top - scrollerRect.top) + scroller.scrollTop;
        
        // 포커스를 childrenWrap의 약간 위쪽(활성 노드 위치)에 맞춤
        const targetScroll = relativeTop - (scroller.clientHeight / 2) + 50;
        
        scroller.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }, 150);

};
window.showNodeActionModal = function(id, name, rank, isPathNode, pathIndex, refCount = 0) {
   if (id === currentUser.uid) {
      // 본인이면 그냥 탐색만 (최상단이면 아무것도 안함)
      if (isPathNode && pathIndex === window.cavePath.length - 1) return;
      window.handleCaveNodeClick(id, name, rank, isPathNode, pathIndex, refCount);
      return;
   }

   const modalHtml = `
      <div id="nodeActionModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center; animation: fadeIn 0.2s;">
         <div style="background:var(--bg-card); padding:24px; border-radius:16px; width:300px; text-align:center; border:1px solid rgba(255,255,255,0.1); animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <div style="width:50px; height:50px; border-radius:50%; background:rgba(255,255,255,0.1); overflow:hidden; margin:0 auto 12px;">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${name}&backgroundColor=transparent" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <h3 style="margin-top:0; margin-bottom:16px; color:#fff;">${name} <span style="font-size:12px; font-weight:normal; background:var(--primary); padding:2px 6px; border-radius:8px;">${rank}</span></h3>
            
            <button onclick="window.doNodeAction('chat', '${id}', '${(name||``).replace(/'/g, `\\'`)}')" style="width:100%; padding:14px; border-radius:10px; border:none; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:#fff; font-weight:bold; margin-bottom:10px; cursor:pointer; font-size:15px; display:flex; justify-content:center; align-items:center; gap:8px;">
                <i class="fas fa-comment-dots"></i> 1:1 채팅하기
            </button>
            <button onclick="window.doNodeAction('nav', '${id}', '${(name||``).replace(/'/g, `\\'`)}', '${rank}', ${isPathNode}, ${pathIndex}, '${refCount}')" style="width:100%; padding:14px; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:#fff; font-weight:bold; margin-bottom:12px; cursor:pointer; font-size:15px; display:flex; justify-content:center; align-items:center; gap:8px;">
                <i class="fas fa-sitemap"></i> ${isPathNode ? '이곳으로 이동' : '상세보기 (하위 조직)'}
            </button>
            
            <button onclick="document.getElementById('nodeActionModal').remove()" style="width:100%; padding:12px; border-radius:10px; border:none; background:transparent; color:var(--text-sec); cursor:pointer; font-size:14px;">
                닫기
            </button>
         </div>
      </div>
   `;
   document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.doNodeAction = function(action, id, name, rank, isPathNode, pathIndex, refCount = 0) {
   const modal = document.getElementById('nodeActionModal');
   if (modal) modal.remove();
   
   if (action === 'chat') {
       window.switchPage('chat');
       if (window.chatManager && window.chatManager.openDirectChat) {
           window.chatManager.openDirectChat(id, name);
       }
   } else if (action === 'nav') {
       window.handleCaveNodeClick(id, name, rank, isPathNode, pathIndex, refCount);
   }
};

window.handleCaveNodeClick = function(id, name, rank, isPathNode, pathIndex, refCount = 0) {
   if (isPathNode) {
      // Clicked a node already in the path -> truncate path to this node
      if (pathIndex === window.cavePath.length - 1) return; // Already the tip
      window.cavePath = window.cavePath.slice(0, pathIndex + 1);
      window.renderCaveTree();
   } else {
      // Clicked a child -> add to path
      window.cavePath.push({ id, name, rank, referralCount: refCount });
      window.renderCaveTree();
   }
};

// Remove resetOrgZoom logic entirely, not needed.

  window.copyReferralCode = function() {
  const code = document.getElementById('myReferralCode');
  if (code) navigator.clipboard.writeText(code.textContent).then(() => showToast('추천 코드 복사 완료!', 'success'));
};

window.shareReferralLink = function() {
  const code = userData?.referralCode || '';
  const url = location.origin + '?ref=' + code;
  if (navigator.share) {
    navigator.share({ title: 'DEEDRA 초대', text: '추천 코드: ' + code, url });
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


// ==== 🎮 게임 로그 로드 ====
async function loadMyGameLogs() {
  const listEl = document.getElementById('gameLogList');
  if (!listEl || !window.FB) return;
  const { collection, query, where, getDocs, limit, orderBy, db } = window.FB;
  if (!currentUser) return;

  try {
    const q = query(collection(db, 'gamelogs'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><span data-i18n="gameStartHint">게임을 시작해보세요!</span></div>';
      return;
    }

    const html = snap.docs.map(docSnap => {
      const d = docSnap.data();
      const isWin = d.win || d.ddraChange > 0;
      const amount = Math.abs(d.ddraChange || d.betAmount || 0);
      const name = d.gameName || d.game || d.gameType || '게임';
      const timeStr = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : new Date().toLocaleString();
      
      return `
        <div class="tx-item">
          <div class="tx-icon ${isWin ? 'icon-deposit' : 'icon-withdrawal'}">
            <i class="fas ${isWin ? 'fa-trophy' : 'fa-times'}"></i>
          </div>
          <div class="tx-info">
            <div class="tx-type">${name} ${isWin ? '승리' : '패배'}</div>
            <div class="tx-date">${timeStr}</div>
          </div>
          <div class="tx-amount ${isWin ? 'amount-pos' : 'amount-neg'}">
            ${isWin ? '+' : '-'}${amount.toFixed(2)} DDRA
          </div>
        </div>
      `;
    }).join('');
    
    listEl.innerHTML = html;
  } catch (e) {
    console.warn('Failed to load game logs', e);
  }
}

function updateGameUI() {
  loadMyGameLogs();
  const bonus = walletData?.bonusBalance || 0;
  gameBalanceVal = Math.floor((bonus / (deedraPrice || 0.5)) * 100) / 100; // DDRA
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('gameBalance', fmt(gameBalanceVal));
  setEl('gameBalanceUsd', '≈ $' + fmt(gameBalanceVal * (deedraPrice || 0.5)));
}

// 충전 모달 관련 함수 - 더 이상 사용 안 함 (하위 호환성 유지)
window.chargeGameWallet = function() { /* 충전 시스템 제거됨 */ };
window.submitCharge = function() { /* 충전 시스템 제거됨 */ };

window.startGame = function(type) {
  if (gameBalanceVal < 0.1) {
    showToast('게임을 플레이하려면 최소 0.1 DDRA 이상의 수익 잔액이 필요합니다.', 'warning');
    return;
  }
  closeAllGames();
  const gameMap = { oddeven: 'gameOddEven', dice: 'gameDice', slot: 'gameSlot', roulette: 'gameRoulette', baccarat: 'gameBaccarat', poker: 'gamePoker' };
  const el = document.getElementById(gameMap[type]);
  if (el) el.classList.remove('hidden');

  // 슬라이더 최대값: DDRA 수량 기준
  const maxDdra = Math.max(0.1, Math.floor(gameBalanceVal * 100) / 100);
  
  const typeCode = type === 'oddeven' ? 'oe' : type === 'dice' ? 'dice' : type === 'slot' ? 'slot' : type === 'roulette' ? 'rl' : type === 'baccarat' ? 'bac' : type === 'poker' ? 'pk' : null;
  const sliderId = typeCode ? typeCode + 'BetSlider' : null;
  
  const slider = document.getElementById(sliderId);
  if (slider) {
    slider.max = maxDdra;
    let defaultBet = Math.max(0.1, Math.min(10, maxDdra));
    slider.value = defaultBet;
    if (typeof updateBetDisplay === 'function') updateBetDisplay(typeCode, defaultBet);
  }

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
  val = Math.max(0.1, parseFloat(val) || 0.1);
  const maxDdra = Math.max(0.1, Math.floor(gameBalanceVal * 100) / 100);
  val = Math.min(val, maxDdra);
  val = Math.round(val * 100) / 100;
  const usdt = fmt(_ddraToUsdt(val));
  const inputEl = document.getElementById(type + 'BetInput');
  if (inputEl && inputEl.value != val) inputEl.value = val;
  
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


window.adjustBet = function(type, delta) {
  let current = 0;
  if (type === 'oe') current = oeBetVal;
  else if (type === 'dice') current = diceBetVal;
  else if (type === 'slot') current = slotBetVal;
  else if (type === 'rl') current = rlBetVal;
  else if (type === 'bac') current = bacBetVal;
  else if (type === 'pk') current = pkBetVal;
  
  let newVal = (parseFloat(current) || 0) + delta;
  updateBetDisplay(type, newVal);
};

window.setBetAmount = function(type, val) {
  updateBetDisplay(type, val);
};

window.setBetGameHalf = function(type) {
  const maxDdra = Math.max(0.1, Math.floor(gameBalanceVal * 100) / 100);
  setBetAmount(type, Math.max(0.1, maxDdra / 2));
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
    if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + ddraChange * (deedraPrice || 0.5));
    updateGameUI();
    updateHomeUI();

    if (coin) {
      coin.classList.remove('coin-flipping');
      // Update coin appearance dynamically
      const heads = coin.querySelector('.heads');
      const inner = heads.querySelector('.coin-face-inner');
      if (forcedResult === 'odd') {
         heads.style.background = 'radial-gradient(circle at 35% 35%, #93c5fd, #3b82f6 40%, #1d4ed8 75%, #1e3a8a)';
         heads.style.boxShadow = 'inset -4px -4px 12px rgba(0,0,0,0.3), inset 2px 2px 8px rgba(255,255,255,0.4), 0 0 30px rgba(59,130,246,0.6)';
         inner.textContent = '홀';
      } else {
         heads.style.background = 'radial-gradient(circle at 35% 35%, #fca5a5, #ef4444 40%, #b91c1c 75%, #7f1d1d)';
         heads.style.boxShadow = 'inset -4px -4px 12px rgba(0,0,0,0.3), inset 2px 2px 8px rgba(255,255,255,0.4), 0 0 30px rgba(239,68,68,0.6)';
         inner.textContent = '짝';
      }
    }
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
    logGame('홀짝', win, oeBetVal, ddraChange);
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
    // Animation handles the rolling look
    dice3d.style.transform = ''; // clear inline style so animation works
  }

  setTimeout(() => {
    const userWins = houseRandom('dice');
    const adminUserWinRate = 100 - (gameOdds['dice']?.houseWinRate ?? gameOdds.global.houseWinRate);
    // Dice payout is 6x. Natural win rate is 1/6 (16.6%).
    // Scale admin setting so 50% = 16.6% win rate
    const adjustedProb = (1.0 / 6.0) * (adminUserWinRate / 50.0);
    const actualUserWins = Math.random() < adjustedProb;

    // 유저가 이기면 선택한 숫자, 지면 다른 숫자
    const result = actualUserWins
      ? chosenNum
      : (() => { const others = [1,2,3,4,5,6].filter(n => n !== chosenNum); return others[Math.floor(Math.random() * others.length)]; })();
    userWins = actualUserWins; // Override original userWins for UI/Logging
    const win = userWins;
    const betUsdt = _ddraToUsdt(diceBetVal);
    const ddraChange = win ? diceBetVal * 5 : -diceBetVal;
    if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + ddraChange * (deedraPrice || 0.5));
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
    logGame('주사위', win, diceBetVal, ddraChange);
  }, 1000);
};

window.playSpin = function() {
  SFX.play('slot_spin');
  if (gameBalanceVal < slotBetVal) { showToast('잔액 부족 (게임 가능 DDRA: ' + fmt(gameBalanceVal) + ')', 'error'); return; }

  const spinBtn = document.getElementById('spinBtn');
  if (spinBtn) { spinBtn.disabled = true; spinBtn.innerHTML = '<span class="spin-icon" style="display:inline-block;animation:spinRotate 0.3s linear infinite">🎰</span> 스피닝...'; }

  const reels = ['reel1', 'reel2', 'reel3'].map(id => document.getElementById(id));

  // 각 릴마다 다른 타이밍으로 스핀 시작
  const spinIntervals = [];
  reels.forEach((r, i) => {
    if (r) {
      setTimeout(() => {
        r.classList.add('spinning');
        spinIntervals[i] = setInterval(() => {
          r.textContent = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        }, 50); // 빠르게 이미지 변경
      }, i * 100);
    }
  });

  // 릴별로 다른 시점에 멈춤 (순차적으로)
  const stopTimes = [800, 1100, 1400];
  
  const adminUserWinRate = 100 - (gameOdds['slot']?.houseWinRate ?? gameOdds.global.houseWinRate);
  // Slot avg payout is ~8x. So we scale the admin win rate down to a safe RTP.
  // 50% admin setting -> 5% actual win rate.
  const adjustedProb = adminUserWinRate / 1000.0; 
  
  const slotUserWins = Math.random() < adjustedProb;
  let result;
  if (slotUserWins) {
    // 가중치 적용 (낮은 배율이 훨씬 자주 나오도록)
    const weights = [
      { sym: '🍋', w: 40 }, // 5x
      { sym: '🍇', w: 30 }, // 5x
      { sym: '🍎', w: 15 }, // 5x
      { sym: '🍊', w: 10 }, // 5x
      { sym: '⭐', w: 3 },  // 10x
      { sym: '7️⃣', w: 1.5 },// 20x
      { sym: '💎', w: 0.5 } // 50x
    ];
    const totalW = weights.reduce((acc, curr) => acc + curr.w, 0);
    let r = Math.random() * totalW;
    let sym = '🍋';
    for (const item of weights) {
      if (r < item.w) { sym = item.sym; break; }
      r -= item.w;
    }
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
        clearInterval(spinIntervals[i]);
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
    const ddraChange = win ? (earned - slotBetVal) : -slotBetVal;
    if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + ddraChange * (deedraPrice || 0.5));
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
    if (spinBtn) { spinBtn.disabled = false; if(document.getElementById('spinBtnIcon')) document.getElementById('spinBtnIcon').textContent='🎰'; if(document.getElementById('spinBtnText')) document.getElementById('spinBtnText').textContent='SPIN!'; spinBtn.disabled = false; }
    logGame('슬롯머신', win, slotBetVal, ddraChange);
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
  
  const naturalProb = winNums.length / 37.0;
  // Admin win rate (0~100). Default houseWinRate is 3 -> user win rate is 97? 
  // Wait, gameOdds['roulette'].houseWinRate. If admin sets user win 30%, house is 70.
  const adminUserWinRate = 100 - (gameOdds['roulette']?.houseWinRate ?? gameOdds.global.houseWinRate);
  // Scale natural probability by admin's setting. 50% admin setting = natural prob.
  const adjustedProb = naturalProb * (adminUserWinRate / 50.0);
  
  const rlUserWins = Math.random() < adjustedProb;
  let resultNum;
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
  const ddraChange = win ? (earnedDdra - rlBetVal) : -rlBetVal;
  if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + ddraChange * (deedraPrice || 0.5));
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

  logGame('룰렛', win, rlBetVal, ddraChange);
}

function logGame(gameName, win, bet, actualDdraChange) {
  const listEl = document.getElementById('gameLogList');
  if (!listEl) return;

  const emptyEl = listEl.querySelector('.empty-state');
  if (emptyEl) emptyEl.remove();

  const changeValue = actualDdraChange !== undefined ? actualDdraChange : (win ? bet : -bet);
  const isPositive = changeValue >= 0;

  const item = document.createElement('div');
  item.className = 'tx-item';
  item.innerHTML = `
    <div class="tx-icon game">${isPositive ? '🎉' : '😢'}</div>
    <div class="tx-info">
      <div class="tx-title">${gameName} ${isPositive ? '승리' : '패배'}</div>
      <div class="tx-date">${new Date().toLocaleTimeString('ko-KR')}</div>
    </div>
    <div class="tx-amount ${isPositive ? 'plus' : 'minus'}">
      ${isPositive ? '+' : ''}${fmt(changeValue)} DDRA
    </div>`;
  listEl.insertBefore(item, listEl.firstChild);

  // Firestore 실시간 동기화 (gamelogs 기록 + wallets bonusBalance 즉시 반영)
  if (!currentUser || !walletData) return;
  try {
    const { addDoc, collection, doc, updateDoc, db, serverTimestamp } = window.FB;
    const ddraChange = changeValue;
    const usdtChange = _ddraToUsdt(ddraChange);
    
    // NOTE: walletData.bonusBalance is already updated correctly by the game logic before logGame is called.
    const newBonus = walletData.bonusBalance;

    // gamelogs 컬렉션에 기록
    addDoc(collection(db, 'gamelogs'), {
      userId: currentUser.uid,
      userEmail: currentUser.email || null,
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
  const ddraChange = win ? (earned - bacBetVal) : -bacBetVal;
  if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + ddraChange * (deedraPrice || 0.5));
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

  logGame('바카라', ddraChange >= 0, bacBetVal, ddraChange);

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
  if (btn) { if (btn) { btn.disabled = false; } btn.textContent = '🃏 딜 (카드 받기)'; }
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
  if (walletData) walletData.bonusBalance = Math.max(0, (walletData.bonusBalance || 0) + ddraChange * (deedraPrice || 0.5));
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

  logGame('포커', ddraChange >= 0, pkBetVal, ddraChange);

  setTimeout(() => {
    pkDealing = false;
    if (btn) { if (btn) { btn.disabled = false; } btn.textContent = '🃏 다시 딜!'; }
  }, 1000);
};

// ===== 마이페이지 (More 탭 내) =====
window.showProfileEdit = function() {
  if (!userData) return;
  const nameEl    = document.getElementById('editName');
  const phoneEl   = document.getElementById('editPhone');
  const countryEl = document.getElementById('editCountry');
  if (nameEl)    nameEl.value    = userData.name    || '';
  if (phoneEl)   phoneEl.value   = userData.phone   || '';
  if (countryEl) countryEl.value = userData.country || '';
  document.getElementById('profileModal').classList.remove('hidden');
};

window.saveProfile = async function() {
  const name    = document.getElementById('editName').value.trim();
  const phone   = document.getElementById('editPhone').value.trim();
  const country = document.getElementById('editCountry')?.value || '';
  if (!name) { showToast('이름을 입력하세요.', 'warning'); return; }

  const btn = window.event ? (window.event.currentTarget || window.event.target) : null;
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    if (window.FB._useRestAPI) {
      const res = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.FB._idToken },
        body: JSON.stringify({ name, phone, country })
      });
      if (!res.ok) throw new Error('API request failed');
    } else {
      const { doc, updateDoc, db } = window.FB;
      await updateDoc(doc(db, 'users', currentUser.uid), { name, phone, country });
    }
    userData.name = name; userData.phone = phone; userData.country = country;
    closeModal('profileModal');
    showToast('프로필이 저장되었습니다.', 'success');
    loadMorePage();
    updateHomeUI();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; } btn.textContent = '저장';
  }
};

window.showPasswordChange = function() {
  document.getElementById('oldPasswordInput').value = '';
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('confirmNewPasswordInput').value = '';
  document.getElementById('passwordChangeModal').classList.remove('hidden');
};

window.submitPasswordChange = async function() {
  if (!currentUser || !currentUser.email) return showToast('로그인 정보가 없습니다.', 'error');
  
  const oldPw = document.getElementById('oldPasswordInput').value;
  const newPw = document.getElementById('newPasswordInput').value;
  const newPwConfirm = document.getElementById('confirmNewPasswordInput').value;

  if (!oldPw) return showToast('기존 비밀번호를 입력해주세요.', 'error');
  if (!newPw) return showToast('새 비밀번호를 입력해주세요.', 'error');
  if (newPw !== newPwConfirm) return showToast('새 비밀번호가 일치하지 않습니다.', 'error');
  if (newPw.length < 6) return showToast('새 비밀번호는 6자리 이상이어야 합니다.', 'error');

  const btn = document.getElementById('savePasswordBtn');
  btn.disabled = true;
  btn.textContent = '변경 중...';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, oldPassword: oldPw, newPassword: newPw })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '비밀번호 변경 실패');
    }
    
    showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
    closeModal('passwordChangeModal');
  } catch (err) {
    console.error('Password change error:', err);
    showToast(err.message || '비밀번호 변경에 실패했습니다.', 'error');
  } finally {
    if (btn) { btn.disabled = false; }
    btn.textContent = '비밀번호 변경하기';
  }
};

window.showWithdrawPinSetup = function() {
  document.getElementById('newPin').value = '';
  document.getElementById('confirmPin').value = '';
  document.getElementById('pinModal').classList.remove('hidden');
};

window.saveWithdrawPin = async function() {
  const pin = document.getElementById('newPin').value.trim();
  const confirm = document.getElementById('confirmPin').value.trim();
  if (!pin || pin.length !== 6) { showToast('6자리 PIN을 입력하세요.', 'warning'); return; }
  if (pin !== confirm) { showToast('PIN이 일치하지 않습니다.', 'error'); return; }
  if (!/^\d{6}$/.test(pin)) { showToast('숫자 6자리를 입력하세요.', 'warning'); return; }

  const btn = window.event ? (window.event.currentTarget || window.event.target) : null;
  btn.disabled = true;
  try {
    if (window.FB._useRestAPI) {
      const res = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.FB._idToken },
        body: JSON.stringify({ withdrawPin: btoa(pin) })
      });
      if (!res.ok) throw new Error('API request failed');
    } else {
      const { doc, updateDoc, db } = window.FB;
      await updateDoc(doc(db, 'users', currentUser.uid), { withdrawPin: btoa(pin) });
    }
    userData.withdrawPin = btoa(pin);
    closeModal('pinModal');
    showToast('출금 PIN이 설정되었습니다.', 'success');
  } catch (err) {
    showToast('설정 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; }
  }
};

window.showTickets = async function() {
  const { collection, query, where, getDocs, limit, db } = window.FB;
  document.getElementById('ticketModal').classList.remove('hidden');
  const listEl = document.getElementById('ticketList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';

  try {
    // 단일 where만 사용 → JS 정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (!tickets.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state">' + (t('emptyTicket') || '문의 내역이 없습니다') + '</div>';
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

  const btn = window.event ? (window.event.currentTarget || window.event.target) : null;
  if (btn) { btn.disabled = true; btn.textContent = '등록 중...'; }
  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'tickets'), {
      userId: currentUser.uid, userEmail: currentUser.email || null,
      title, content, status: 'open', createdAt: serverTimestamp(),
    });
    document.getElementById('ticketTitle').value = '';
    document.getElementById('ticketContent').value = '';
    closeModal('ticketModal');
    showToast('문의가 등록되었습니다.', 'success');
  } catch (err) {
    showToast('등록 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; } btn.textContent = '문의 등록';
  }
};

// ===== 알림 시스템 =====
let _notiUnsubscribe = null;

// 앱 시작 시 실시간 알림 리스너 등록 (initApp에서 호출)
async function startNotificationListener() {
  if (!currentUser) return;
  const { collection, query, where, onSnapshot, db, limit } = window.FB;
  if (_notiUnsubscribe) _notiUnsubscribe(); // 기존 리스너 해제
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      limit(50)
    );
    let isInitialLoad = true;
    _notiUnsubscribe = onSnapshot(q, (snap) => {
      // 뱃지 업데이트
      const count = snap.docs.filter(d => !d.data().isRead).length;
      const badge = document.getElementById('notiBadge');
      if (badge) {
        if (count > 0) { badge.classList.remove('hidden'); badge.textContent = count > 9 ? '9+' : count; }
        else { badge.classList.add('hidden'); badge.textContent = ''; }
      }

      // 새 알림 토스트 띄우기 및 관련 뷰 새로고침
      if (!isInitialLoad) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (!data.isRead) {
               showToast(`🔔 ${data.title || '새 알림이 도착했습니다.'}`, 'info');
               
               // 입/출금 승인 알림이면 실시간으로 내역 목록도 리로드
               if (data.type === 'deposit_approved' || data.type === 'withdrawal_approved') {
                 if (window.currentPage === 'asset') {
                     setTimeout(() => window.switchPage('asset'), 500);
                 }
               }
            }
          }
        });
      }
      isInitialLoad = false;

    }, () => {});
  } catch(e) { console.warn('[Noti] 리스너 오류:', e); }
}

window.showNotifications = async function() {
  const { collection, query, where, getDocs, doc, updateDoc, writeBatch, db, limit, serverTimestamp } = window.FB;
  const modal = document.getElementById('notiModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const listEl = document.getElementById('notiList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';
  try {
    // 단일 where만 사용 → JS 정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      limit(30)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    // 읽지 않은 알림 일괄 읽음 처리
    const unread = snap.docs.filter(d => !d.data().isRead);
    if (unread.length > 0) {
      const batch = writeBatch(db);
      unread.forEach(d => batch.update(doc(db, 'notifications', d.id), { isRead: true }));
      await batch.commit();
    }
    if (!items.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><br>' + (t('emptyNoti') || '알림이 없습니다') + '</div>';
      return;
    }
    const notiIcons = { deposit: '💰', withdrawal: '💸', bonus: '🎁', invest: '📈', system: '📢', game: '🎮', rank: '⭐' };
    window._cachedNotiItems = items; // Store items for detail modal
    if (listEl) listEl.innerHTML = items.map((n, idx) => `
      <div class="noti-item ${n.isRead ? '' : 'unread'}" onclick="openNotiDetail(${idx})">
        <div class="noti-icon">${notiIcons[n.type] || '🔔'}</div>
        <div class="noti-body">
          <div class="noti-title">${n.title || '알림'}</div>
          <div class="noti-msg">${n.message || ''}</div>
          <div class="noti-date">${fmtDate(n.createdAt)}</div>
        </div>
      </div>
    `).join('');
  } catch(e) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">' + (t('loadFail') || '알림을 불러올 수 없습니다') + '</div>';
  }
};

window.openNotiDetail = function(idx) {
  if (!window._cachedNotiItems || !window._cachedNotiItems[idx]) return;
  const n = window._cachedNotiItems[idx];
  const notiIcons = { deposit: '💰', withdrawal: '💸', bonus: '🎁', invest: '📈', system: '📢', game: '🎮', rank: '⭐' };
  
  document.getElementById('notiDetailTitle').innerHTML = (notiIcons[n.type] || '🔔') + ' ' + (n.title || '알림');
  document.getElementById('notiDetailDate').innerText = fmtDate(n.createdAt);
  
  const imgWrapper = document.getElementById('notiDetailImageWrapper');
  const imgEl = document.getElementById('notiDetailImage');
  if (n.imageUrl) {
    imgEl.src = n.imageUrl;
    imgWrapper.style.display = 'block';
  } else {
    imgEl.src = '';
    imgWrapper.style.display = 'none';
  }
  
  // Convert line breaks to <br> for better readability
  const msgHtml = (n.message || '').replace(/\n/g, '<br>');
  document.getElementById('notiDetailBody').innerHTML = msgHtml;
  
  // Close the list modal and open the detail modal
  // closeModal('notiModal'); // Optional: whether to close list or keep it behind
  document.getElementById('notiDetailModal').classList.remove('hidden');
};


// ─── News Logic (Automated 소식통) ───────────────────────────────────────────────────────────
window._cachedNews = null;

window.loadNewsFeed = async function(isRefresh = false) {
  const listEl = document.getElementById('newsFeedList');
  if (isRefresh && listEl) listEl.innerHTML = '<div class="skeleton-item" style="height:22px;margin-bottom:4px;"></div><div class="skeleton-item" style="height:22px;"></div>';
  try {
    const res = await fetch('/api/news-digest');
    const data = await res.json();
    let items = data.items || [];
    window._cachedNews = items; // save for modal
    renderNewsFeed(items, 'newsFeedList');
  } catch (err) {
    console.error('[news] load error:', err);
    if (listEl) listEl.innerHTML = `<div class="empty-state">${t('loadFail')}</div>`;
  }
};

window.showNewsModal = function() {
  const modal = document.getElementById('newsModal');
  if (modal) modal.classList.remove('hidden');
  
  const el = document.getElementById('newsFullList');
  if (!el) return;
  
  const items = window._cachedNews || [];
  if (!items.length) {
    el.innerHTML = `<div class="empty-state">${t('emptyNotice') || '등록된 뉴스가 없습니다'}</div>`;
    return;
  }
  
  el.innerHTML = items.map((n, idx) => {
    const dateStr = n.pubDate ? new Date(n.pubDate).toLocaleDateString() : '';
    return `
      <div class="news-feed-item" style="display:block; padding:16px; margin-bottom:12px; border-bottom:1px solid var(--border);">
        <div style="font-size:11px; color:var(--accent); font-weight:700; margin-bottom:4px;">📰 소식통 (Daily Digest)</div>
        <div style="font-size:14px; font-weight:800; color:var(--text); margin-bottom:8px; line-height:1.4;">${n.title}</div>
        <div style="font-size:12px; color:var(--text2); line-height:1.5; margin-bottom:10px;">${n.description}</div>
        <div style="font-size:11px; color:var(--text3); display:flex; justify-content:space-between;">
          <span>${dateStr}</span>
          <a href="${n.link}" target="_blank" style="color:var(--blue); text-decoration:none;">원문 보기 &rarr;</a>
        </div>
      </div>
    `;
  }).join('');
};

function renderNewsFeed(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="empty-state">${t('emptyNotice') || '등록된 뉴스가 없습니다'}</div>`;
    return;
  }

  const isHome = (containerId === 'newsFeedList');
  const displayItems = isHome ? items.slice(0, 3) : items;

  el.innerHTML = displayItems.map((n, idx) => {
    let title = n.title;
    let source = '소식통';
    
    let dateStr = '';
    try {
      const d = new Date(n.pubDate);
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      dateStr = `${mo}/${dy}`;
    } catch {}

    const thumbHtml = `<div class="news-feed-thumb-placeholder">📰</div>`;

    return `
      <div onclick="showNewsModal()" style="cursor:pointer;" class="news-feed-item">
        ${thumbHtml}
        <div class="news-feed-body">
          <div class="news-feed-source">${source}</div>
          <div class="news-feed-title">${title}</div>
          <div class="news-feed-date">${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

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
  try {
    if (!code) return null;
    const cleanCode = code.trim();
    
    // 백엔드 API를 통해 검증 (비로그인 상태에서도 조회 가능)
    const res = await fetch(`/api/auth/check-referral?code=${encodeURIComponent(cleanCode)}`);
    const data = await res.json();
    
    if (res.ok && data.valid) {
      return {
        uid: data.uid,
        name: data.name,
        username: data.username,
        email: data.email
      };
    }
    return null;
  } catch (e) { console.error('findUser API error:', e); return null; }
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0.00';
  return parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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
  const map = { deposit: 'USDT 입금', withdrawal: 'DEEDRA 출금', bonus: '보너스 지급', invest: 'FREEZE 신청', game: '게임', referral: '추천 보너스', rank_bonus: '판권 매칭', rank_gap_passthru: '예외 보너스', direct_bonus: '추천 매칭', daily_roi: '데일리 수익', center_fee: '센터 피' };
  return map[type] || type;
}

function getAuthErrorMsg(code) {
  const map = {
    'auth/invalid-email': t('authInvalidEmail'),
    'auth/user-not-found': t('authUserNotFound'),
    'auth/wrong-password': t('authWrongPw'),
    'auth/email-already-in-use': t('authEmailUsed'),
    'auth/weak-password': t('authWeakPw'),
    'auth/invalid-credential': t('authInvalidCred'),
    'auth/invalid-login-credentials': t('authInvalidCred'),
    'auth/invalid_login_credentials': t('authInvalidCred'),
    'auth/too-many-requests': t('authTooMany'),
    'auth/too-many-attempts-try-later': t('authTooMany'),
    'auth/network-request-failed': t('authNetworkFail'),
    'auth/user-disabled': t('authDisabled'),
  };
  // REST API 에러 코드 직접 매핑 (auth/ 없는 경우)
  if (!code) return t('loginError');
  const normalized = code.toLowerCase().replace(/_/g, '-');
  if (map[code]) return map[code];
  if (map['auth/' + normalized]) return map['auth/' + normalized];
  if (normalized.includes('invalid') && normalized.includes('credential')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (normalized.includes('too-many')) return '너무 많은 시도가 있었습니다. 잠시 후 다시 시도하세요.';
  return t('authError') + code;
}


// ===== 강제 비밀번호 변경 (초기 000000) =====
window.submitForcePw = async function() {
  const newPw = document.getElementById('forcePwNew').value.trim();
  const confirmPw = document.getElementById('forcePwConfirm').value.trim();
  
  if (!newPw || newPw.length < 6) {
    showToast('비밀번호는 6자리 이상(영문/숫자 조합 권장)이어야 합니다.', 'warning');
    return;
  }
  if (newPw !== confirmPw) {
    showToast('비밀번호가 일치하지 않습니다.', 'warning');
    return;
  }
  if (newPw === '000000') {
    showToast('000000 외의 다른 비밀번호를 사용해주세요.', 'warning');
    return;
  }
  
  const btn = document.getElementById('forcePwBtn');
  btn.disabled = true;
  btn.textContent = '변경 중...';
  
  try {
    const { updatePassword, auth, doc, updateDoc, db } = window.FB;
    const user = auth.currentUser;
    if (!user) throw new Error('로그인 정보가 없습니다.');
    
    // 1. Auth 비밀번호 변경
    await updatePassword(user, newPw);
    
    // 2. DB 업데이트 (플래그 해제)
    await updateDoc(doc(db, 'users', user.uid), {
      forcePwChange: false
    });
    
    sessionStorage.removeItem('deedra_force_pw');
    document.getElementById('forcePwModal').style.display = 'none';
    showToast('비밀번호가 안전하게 변경되었습니다.', 'success');
  } catch (err) {
    console.error('PW Change Error:', err);
    showToast(getAuthErrorMsg(err.code) || '비밀번호 변경 중 오류가 발생했습니다. 다시 로그인해주세요.', 'error');
  } finally {
    if (btn) { btn.disabled = false; }
    btn.textContent = '비밀번호 변경 완료';
  }
};

// ===== 토스트 =====
let toastTimer = null;
let toastShowTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  // 진행 중인 타이머 모두 취소
  if (toastTimer)     { clearTimeout(toastTimer);          toastTimer = null; }
  if (toastShowTimer) { cancelAnimationFrame(toastShowTimer); toastShowTimer = null; }
  // 이미 show 상태면 한 번 빼고 다시 넣어 애니메이션 리셋
  el.classList.remove('show');
  el.className = `toast ${type}`;
  el.textContent = msg;
  // 다음 프레임에서 show 추가 (CSS transition 트리거)
  toastShowTimer = requestAnimationFrame(() => {
    el.classList.add('show');
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      toastTimer = null;
    }, 3000);
  });
}

console.log('✅ DEEDRA app.js v2.0 로드 완료');

// ===== PWA: Service Worker 등록 =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[SW] 등록 완료:', reg.scope);
      // 새 SW 업데이트 감지 → 앱 새로고침 유도
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 업데이트 알림 배너
            const updateBanner = document.createElement('div');
            updateBanner.style.cssText = `
              position:fixed;top:0;left:0;right:0;background:#10b981;color:#fff;
              padding:12px 16px;display:flex;justify-content:space-between;align-items:center;
              z-index:99999;font-size:14px;font-weight:600;
            `;
            updateBanner.innerHTML = `
              <span>🔄 새 버전이 준비됐습니다</span>
              <button onclick="location.reload()" style="background:rgba(255,255,255,0.25);border:none;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;cursor:pointer;">지금 업데이트</button>
            `;
            document.body.prepend(updateBanner);
          }
        });
      });
    }).catch(err => console.warn('[SW] 등록 실패:', err));
  });
}

// ===== PWA: 설치 배너 =====
const PWA_I18N = {
  ko: { title: 'DEEDRA 앱 설치', desc: '홈 화면에 추가하면 더 빠르게 실행돼요', btn: '설치', installed: '✅ DEEDRA 앱이 설치되었습니다!' },
  en: { title: 'Install DEEDRA App', desc: 'Add to home screen for faster access', btn: 'Install', installed: '✅ DEEDRA app installed!' },
  vi: { title: 'Cài đặt ứng dụng DEEDRA', desc: 'Thêm vào màn hình chính để truy cập nhanh hơn', btn: 'Cài đặt', installed: '✅ Ứng dụng DEEDRA đã được cài đặt!' },
  th: { title: 'ติดตั้งแอป DEEDRA', desc: 'เพิ่มลงหน้าจอหลักเพื่อเข้าถึงได้เร็วขึ้น', btn: 'ติดตั้ง', installed: '✅ ติดตั้งแอป DEEDRA สำเร็จ!' },
};

function getPwaI18n() {
  const lang = (typeof currentLang !== 'undefined' ? currentLang : null) ||
               localStorage.getItem('deedra_lang') || 'ko';
  return PWA_I18N[lang] || PWA_I18N['ko'];
}

window.window.deferredPrompt = null;
let pwaInstallShown = false;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  // 설치 배너: 로그인 후 8초 뒤 (너무 빠르면 거부감)
  setTimeout(showInstallBanner, 8000);
});

function showInstallBanner() {
  if (!window.deferredPrompt) return;
  if (pwaInstallShown) return;
  // 이미 3번 거절했으면 더이상 표시 안 함
  const dismissCount = parseInt(localStorage.getItem('pwa_dismiss_count') || '0');
  if (dismissCount >= 3) return;
  // 마지막 거절로부터 3일이 지나지 않았으면 표시 안 함
  const lastDismiss = parseInt(localStorage.getItem('pwa_last_dismiss') || '0');
  if (Date.now() - lastDismiss < 3 * 24 * 60 * 60 * 1000) return;

  pwaInstallShown = true;
  const i18n = getPwaI18n();
  const banner = document.createElement('div');
  banner.id = 'pwaInstallBanner';
  banner.style.cssText = `
    position:fixed;bottom:calc(var(--nav-height,60px) + 12px);left:50%;transform:translateX(-50%);
    background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;
    border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:12px;
    box-shadow:0 8px 32px rgba(99,102,241,0.5);z-index:9990;
    width:calc(100% - 32px);max-width:400px;
    animation:slideUpBanner 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
  `;
  banner.innerHTML = `
    <style>
      @keyframes slideUpBanner {
        from { opacity:0; transform:translateX(-50%) translateY(20px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
    </style>
    <img src="/static/icon-192.png" style="width:44px;height:44px;border-radius:10px;flex-shrink:0;" alt="DEEDRA" />
    <div style="flex:1;min-width:0;">
      <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i18n.title}</div>
      <div style="font-size:12px;opacity:0.85;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i18n.desc}</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;">
      <button id="pwaInstallBtn" style="background:#fff;color:#4f46e5;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;">${i18n.btn}</button>
      <button id="pwaDismissBtn" style="background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:10px;padding:8px 12px;font-size:13px;cursor:pointer;">✕</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
    if (!window.deferredPrompt) return;
    window.deferredPrompt.prompt();
    const { outcome } = await window.deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast(i18n.installed, 'success');
    window.deferredPrompt = null;
    banner.remove();
  });

  document.getElementById('pwaDismissBtn').addEventListener('click', () => {
    const cnt = parseInt(localStorage.getItem('pwa_dismiss_count') || '0') + 1;
    localStorage.setItem('pwa_dismiss_count', String(cnt));
    localStorage.setItem('pwa_last_dismiss', String(Date.now()));
    banner.remove();
    pwaInstallShown = false;
  });

  // 20초 후 자동 숨김
  setTimeout(() => {
    if (document.getElementById('pwaInstallBanner')) {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.5s';
      setTimeout(() => banner.remove(), 500);
      pwaInstallShown = false;
    }
  }, 20000);
}

// iOS Safari: 수동 안내 배너 (beforeinstallprompt 미지원)
function showIosInstallGuide() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.navigator.standalone === true;
  if (!isIos || isInStandaloneMode) return;
  if (localStorage.getItem('pwa_ios_dismissed')) return;

  const i18n = getPwaI18n();
  const guide = document.createElement('div');
  guide.id = 'pwaIosGuide';
  guide.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;
    background:rgba(15,20,40,0.97);color:#fff;
    padding:16px 20px 24px;border-radius:20px 20px 0 0;
    box-shadow:0 -4px 30px rgba(0,0,0,0.5);z-index:9990;
    animation:slideUpBanner 0.4s ease;
  `;
  guide.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="/static/icon-192.png" style="width:40px;height:40px;border-radius:10px;" />
        <span style="font-weight:700;font-size:15px;">${i18n.title}</span>
      </div>
      <button id="pwaIosDismiss" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;padding:4px;">✕</button>
    </div>
    <div style="font-size:13px;color:#ccc;line-height:1.6;">
      <div style="margin-bottom:8px;">① 하단 <strong style="color:#fff;">공유 버튼</strong> <span style="font-size:16px;">⬆️</span> 탭</div>
      <div>② <strong style="color:#fff;">"홈 화면에 추가"</strong> 선택</div>
    </div>
    <div style="margin-top:12px;background:rgba(99,102,241,0.15);border-radius:10px;padding:10px 14px;font-size:12px;color:#a5b4fc;">
      💡 홈 화면에 추가하면 앱처럼 전체화면으로 실행됩니다
    </div>
  `;
  document.body.appendChild(guide);
  document.getElementById('pwaIosDismiss').addEventListener('click', () => {
    localStorage.setItem('pwa_ios_dismissed', '1');
    guide.remove();
  });
  setTimeout(() => {
    if (document.getElementById('pwaIosGuide')) guide.remove();
  }, 15000);
}

window.addEventListener('appinstalled', () => {
  const i18n = getPwaI18n();
  showToast(i18n.installed, 'success');
  window.deferredPrompt = null;
  const b = document.getElementById('pwaInstallBanner');
  if (b) b.remove();
});

// iOS 안내: 로그인 완료 후 5초 뒤
setTimeout(() => {
  if (!('standalone' in navigator)) return; // iOS 아닌 경우 스킵
  showIosInstallGuide();
}, 5000);

// ===== URL 파라미터: 추천인 코드 자동 입력 =====
(function autoFillRefCode() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') || params.get('referral') || params.get('code');
  if (!ref) return;
  // 회원가입 탭 자동 전환 + 코드 입력
  const fill = () => {
    const input = document.getElementById('regReferral');
    if (input) {
      input.value = ref;
      input.dispatchEvent(new Event('input'));
      // X 버튼 표시
      const clearBtn = document.getElementById('refCodeClearBtn');
      if (clearBtn) clearBtn.style.display = 'flex';
      // 추천인 탭으로 자동 이동
      const registerTab = document.getElementById('registerTab');
      if (registerTab && !registerTab.classList.contains('active')) {
        registerTab.click();
      }
      showRefCodeHint(ref);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fill);
  } else {
    setTimeout(fill, 500);
  }
})();

async function showRefCodeHint(code) {
  const hintEl = document.getElementById('refCodeHint');
  const statusEl = document.getElementById('refCodeStatus');
  if (!hintEl || !statusEl) return;
  statusEl.textContent = '🔍';
  try {
    const referrer = await findUserByReferralCode(code);
    if (referrer) {
      statusEl.textContent = '✅';
      statusEl.style.color = '#10b981';
      hintEl.textContent = `✓ 추천인: ${referrer.name || referrer.email || '확인됨'}`;
      hintEl.style.color = '#10b981';
    } else {
      statusEl.textContent = '❌';
      statusEl.style.color = '#ef4444';
      hintEl.textContent = t('registerInvalidRef');
      hintEl.style.color = '#ef4444';
    }
  } catch(e) {
    statusEl.textContent = '';
    hintEl.textContent = '';
  }
}

// 추천인 코드 지우기 버튼
window.clearRefCode = function() {
  const input = document.getElementById('regReferral');
  const hintEl = document.getElementById('refCodeHint');
  const statusEl = document.getElementById('refCodeStatus');
  const clearBtn = document.getElementById('refCodeClearBtn');
  if (input) input.value = '';
  if (hintEl) hintEl.textContent = '';
  if (statusEl) statusEl.textContent = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (input) input.focus();
};

// 아이디 중복 실시간 검증
document.addEventListener('DOMContentLoaded', () => {
  const userInp = document.getElementById('regUsername');
  if (!userInp) return;
  
  // 상태 메시지 표시할 요소 추가
  let statusEl = document.getElementById('regUserStatus');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'regUserStatus';
    statusEl.style.cssText = 'font-size:12px; margin-top:4px; margin-left:4px;';
    userInp.parentNode.appendChild(statusEl);
  }

  let uTimer = null;
  userInp.addEventListener('input', (e) => {
    let val = e.target.value.trim().toLowerCase();
    // 아이디는 영문, 숫자만 허용되도록 정제 (선택사항, 일단 소문자 변환만 유지)
    e.target.value = val;
    
    if (!val) { statusEl.textContent = ''; return; }
    if (val.length < 4) { 
      statusEl.textContent = '아이디는 4자 이상이어야 합니다.';
      statusEl.style.color = '#ef4444';
      return; 
    }
    
    statusEl.textContent = '🔍 중복 확인 중...';
    statusEl.style.color = '#a5b4fc';
    
    clearTimeout(uTimer);
    uTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.exists) {
          statusEl.textContent = '❌ 이미 사용 중인 아이디입니다.';
          statusEl.style.color = '#ef4444';
        } else {
          statusEl.textContent = '✅ 사용 가능한 아이디입니다.';
          statusEl.style.color = '#10b981';
        }
      } catch(err) {
        statusEl.textContent = '';
      }
    }, 600);
  });
});

// 추천인 코드 실시간 검증
document.addEventListener('DOMContentLoaded', () => {
  const refInput = document.getElementById('regReferral');
  if (!refInput) return;
  let refTimer = null;
  refInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    e.target.value = val;
    const hintEl = document.getElementById('refCodeHint');
    const statusEl = document.getElementById('refCodeStatus');
    const clearBtn = document.getElementById('refCodeClearBtn');
    // X 버튼 표시/숨김
    if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';
    if (!val) { if(hintEl) hintEl.textContent=''; if(statusEl) statusEl.textContent=''; return; }
    if (val.length < 6) return;
    clearTimeout(refTimer);
    refTimer = setTimeout(() => showRefCodeHint(val), 800);
  });
});

// ═══════════════════════════════════════════════════════════
// 🌐 네트워크 수익 슬라이드업 패널
// ═══════════════════════════════════════════════════════════
let _nepCurrentTab = 'tx';
let _nepLoaded = { tx: false, gen1: false, gen2: false, deep: false };
let _nepAllUsers = null;  // 전체 사용자 캐시

/** 이메일 마스킹: @ 앞자리까지만 표시 */
function maskEmail(email) {
  if (!email) return '***';
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return email.slice(0, 2) + '***';
  const local = email.slice(0, atIdx);
  if (local.length <= 3) return local + '@***';
  return local.slice(0, 3) + '***@' + email.slice(atIdx + 1).split('.')[0] + '.**';
}

/** 패널 열기 */
window.showNetworkEarningsPanel = function(tab = 'tx') {
  const panel = document.getElementById('networkEarningsPanel');
  const backdrop = document.getElementById('nepBackdrop');
  const sheet = document.getElementById('nepSheet');
  if (!panel) return;

  _nepCurrentTab = tab;
  _nepLoaded = { tx: false, gen1: false, gen2: false, deep: false };

  // 표시
  panel.style.pointerEvents = 'auto';
  backdrop.style.pointerEvents = 'auto';
  backdrop.style.opacity = '1';
  sheet.style.transform = 'translateY(0)';

  // 탭 활성화
  _activateNepTab(tab);
  // 요약 로드
  _loadNepSummary();
  // 탭 콘텐츠 로드
  _loadNepTab(tab);
};

/** 패널 닫기 */
window.closeNetworkEarningsPanel = function() {
  const panel = document.getElementById('networkEarningsPanel');
  const backdrop = document.getElementById('nepBackdrop');
  const sheet = document.getElementById('nepSheet');
  if (!panel) return;
  backdrop.style.opacity = '0';
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    panel.style.pointerEvents = 'none';
    backdrop.style.pointerEvents = 'none';
  }, 350);
};

/** 탭 전환 */
window.switchNepTab = function(tab) {
  _nepCurrentTab = tab;
  _activateNepTab(tab);
  _loadNepTab(tab);
};

function _activateNepTab(tab) {
  document.querySelectorAll('.nep-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.style.color = isActive ? '#3b82f6' : 'var(--text2, #94a3b8)';
    btn.style.borderBottomColor = isActive ? '#3b82f6' : 'transparent';
    btn.style.fontWeight = isActive ? '700' : '600';
  });
}

/** 요약 카드 데이터 로드 — 1대/2대/3대+ 당일 수익 각각 집계 */
async function _loadNepSummary() {
  if (!currentUser) return;
  const { collection, query, where, getDocs, limit, db } = window.FB;

  try {
    let allUsers = _nepAllUsers || [];
    if (!allUsers.length) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _nepAllUsers = allUsers;
      } catch (rulesErr) {
        console.warn('[NEP] fallback to manual recursive fetch due to rules error:', rulesErr.message);
        
        // Fallback: Recursive query for gen1, gen2, gen3
        const q1 = query(collection(db, 'users'), where('referredBy', '==', currentUser.uid));
        const snap1 = await getDocs(q1);
        const gen1 = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let gen2 = [];
        if (gen1.length > 0) {
          const gen1Ids = gen1.map(u => u.id);
          for (let i = 0; i < gen1Ids.length; i += 10) {
            const chunk = gen1Ids.slice(i, i + 10);
            const q2 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap2 = await getDocs(q2);
            gen2.push(...snap2.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        let gen3 = [];
        if (gen2.length > 0) {
          const gen2Ids = gen2.map(u => u.id);
          for (let i = 0; i < gen2Ids.length; i += 10) {
            const chunk = gen2Ids.slice(i, i + 10);
            const q3 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap3 = await getDocs(q3);
            gen3.push(...snap3.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        allUsers = [...gen1, ...gen2, ...gen3];
        _nepAllUsers = allUsers; // cache it
      }
    }

    // ── 대수별 멤버 분류 (BFS) ──
    const genMap = {}; // uid → generation number
    let bfsQueue = allUsers.filter(u => u.referredBy === currentUser.uid && u.role !== 'admin');
    bfsQueue.forEach(u => { genMap[u.id] = 1; });
    while (bfsQueue.length) {
      const next = [];
      for (const u of bfsQueue) {
        const children = allUsers.filter(c => c.referredBy === u.id && c.role !== 'admin');
        children.forEach(c => {
          if (genMap[c.id] === undefined) { genMap[c.id] = genMap[u.id] + 1; next.push(c); }
        });
      }
      bfsQueue = next;
    }

    const gen1ids = Object.entries(genMap).filter(([,g]) => g === 1).map(([id]) => id);
    const gen2ids = Object.entries(genMap).filter(([,g]) => g === 2).map(([id]) => id);
    const gen3ids = Object.entries(genMap).filter(([,g]) => g >= 3).map(([id]) => id);
    const totalMembers = Object.keys(genMap).length;

    // ── 오늘 날짜 ──
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

    // ── 내 보너스 전체 조회 (단일 where) → JS에서 날짜·fromUserId 필터 ──
    let todayGen1 = 0, todayGen2 = 0, todayGen3 = 0;
    let totalRankBonusEarned = 0;
    try {
      const myBonusQ = query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid));
      const myBonusSnap = await getDocs(myBonusQ);
      myBonusSnap.docs.forEach(d => {
        const data = d.data();
        const t = data.type;
        // 판권 매칭 보너스만 취급
        if (!['rank_bonus', 'rank_gap_passthru', 'rank_equal_or_higher_override_1pct', 'rank_equal_or_higher_override'].includes(t)) return;
        
        const amtValue = data.amountUsdt !== undefined ? data.amountUsdt : (data.amount || 0);
        totalRankBonusEarned += amtValue; // 누적 판권매칭 수익

        const date = data.settlementDate || (data.createdAt?.toDate?.()?.toISOString?.()?.slice(0,10)) || '';
        if (date !== today) return;
        const from = data.fromUserId || '';
        const amt = data.amountUsdt !== undefined ? data.amountUsdt : (data.amount || 0);
        if (gen1ids.includes(from)) todayGen1 += amt;
        else if (gen2ids.includes(from)) todayGen2 += amt;
        else if (gen3ids.includes(from)) todayGen3 += amt;
      });
    } catch(_) {}

    const todayTotal = todayGen1 + todayGen2 + todayGen3;

    // ── 누적 수익 (판권 매칭 총합) ──
    const totalEarning = totalRankBonusEarned; // 판권 매칭 누적액만 표시

    // ── 요약 카드 업데이트 ──
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('nepGen1Today', '$' + fmt(todayGen1));
    setEl('nepGen1Count', gen1ids.length + t('memberCount'));
    setEl('nepGen2Today', '$' + fmt(todayGen2));
    setEl('nepGen2Count', gen2ids.length + t('memberCount'));
    setEl('nepGen3Today', '$' + fmt(todayGen3));
    setEl('nepGen3Count', gen3ids.length + t('memberCount'));
    setEl('nepTodayEarning', '$' + fmt(todayTotal));
    setEl('nepTotalMembers', totalMembers + t('memberCount'));
    setEl('nepTotalEarning', '$' + fmt(totalEarning));
    setEl('nepSubTitle', `${t('subMembers')} ${totalMembers}${t('peopleUnit')} · ${t('todayEarn')} $${fmt(todayTotal)}`);

    // ── 홈 미리보기 업데이트 ──
    setEl('homeNetTodayEarn', '$' + fmt(todayTotal));
    setEl('homeNetMembers', totalMembers + t('memberCount'));
    setEl('homeNetTotalEarn', '$' + fmt(totalEarning));

  } catch(e) {
    console.warn('[NEP] summary load error:', e);
  }
}

/** 탭별 콘텐츠 로드 */
async function _loadNepTab(tab) {
  const contentEl = document.getElementById('nepContent');
  if (!contentEl) return;

  if (tab === 'tx') {
    await _loadNepTxTab(contentEl);
  } else if (tab === 'gen1') {
    await _loadNepGenTab(contentEl, 1);
  } else if (tab === 'gen2') {
    await _loadNepGenTab(contentEl, 2);
  } else if (tab === 'deep') {
    await _loadNepDeepTab(contentEl);
  }
}

/** 💳 거래내역 탭 */
async function _loadNepTxTab(contentEl) {
  contentEl.innerHTML = `<div class="skeleton-item" style="margin-bottom:8px"></div><div class="skeleton-item" style="margin-bottom:8px"></div><div class="skeleton-item"></div>`;
  const { collection, query, where, getDocs, limit, db } = window.FB;

  try {
    // 단일 where만 사용
    const qTx = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), limit(30));
    const qBonus = query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), limit(30));
    
    const [snapTx, snapBonus] = await Promise.all([getDocs(qTx), getDocs(qBonus)]);
    
    let allData = [
      ...snapTx.docs.map(d => ({ id: d.id, ...d.data() })),
      ...snapBonus.docs.map(d => ({ id: d.id, ...d.data(), isBonus: true }))
    ];
    
    // 네트워크 수익 관련 항목만 필터링 (선택적)
    // tx는 출금/입금, bonus는 추천매칭, 판권매칭 등
    const txs = allData.sort((a, b) => {
      const aTime = a.createdAt?.seconds || (new Date(a.settlementDate||0).getTime()/1000) || 0;
      const bTime = b.createdAt?.seconds || (new Date(b.settlementDate||0).getTime()/1000) || 0;
      return bTime - aTime;
    });

    if (!txs.length) {
      contentEl.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><br>${t('emptyTx')}</div>`;
      return;
    }

    const icons = { deposit: '⬇️', withdrawal: '⬆️', bonus: '🎁', invest: '📈', game: '🎮', direct_bonus: '👥', rank_bonus: '🏆', rank_gap_passthru: '🛡️', daily_roi: '☀️' };
    const statusTxt = { pending: t('statusPending'), approved: t('statusApproved'), rejected: t('statusRejected') };
    const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

    contentEl.innerHTML = txs.map(tx => {
      tx.amount = tx.amountUsdt !== undefined ? tx.amountUsdt : (tx.amount || 0); if (tx.type === "withdrawal") tx.currency = "USDT";
      const isPlus = ['deposit', 'bonus', 'rank_bonus', 'direct_bonus', 'daily_roi', 'center_fee', 'rank_gap_passthru'].includes(tx.type);
      const sc = statusColor[tx.status] || '#94a3b8';
      return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.07);
          display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
          ${icons[tx.type] || '💱'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text,#f1f5f9);">${getTxTypeName(tx.type)}</div>
          <div style="font-size:11px;color:var(--text2,#94a3b8);margin-top:2px;">${tx.settlementDate || fmtDate(tx.createdAt)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:14px;font-weight:700;color:${isPlus ? '#10b981' : '#f87171'};">
            ${isPlus ? '+' : '-'}${fmt(tx.amount)} ${tx.currency || 'USDT'}
          </div>
          <div style="font-size:10px;color:${sc};margin-top:2px;">${statusTxt[tx.status] || tx.status}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('[NEP] tx tab error:', e);
    const msg = e.code === 'permission-denied' || e.message?.includes('Missing or insufficient')
      ? '⚠️ 데이터 접근 권한이 없습니다.<br><small>Firebase 콘솔에서 Firestore 보안 규칙을 배포해 주세요.</small>'
      : `오류: ${e.message || '불러오기 실패'}`;
    contentEl.innerHTML = `<div class="empty-state" style="color:#f87171;">${msg}</div>`;
  }
}

/** 👤 1대 / 👥 2대 탭 — compact 목록 (ID·데일리·합계) */
async function _loadNepGenTab(contentEl, gen) {
  contentEl.innerHTML = `<div class="skeleton-item" style="margin-bottom:6px"></div><div class="skeleton-item" style="margin-bottom:6px"></div><div class="skeleton-item"></div>`;
  const { collection, query, where, getDocs, limit, db } = window.FB;

  try {
    let allUsers = _nepAllUsers || [];
    if (!allUsers.length) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _nepAllUsers = allUsers;
      } catch (rulesErr) {
        console.warn('[NEP] fallback to manual recursive fetch due to rules error:', rulesErr.message);
        
        // Fallback: Recursive query for gen1, gen2, gen3
        const q1 = query(collection(db, 'users'), where('referredBy', '==', currentUser.uid));
        const snap1 = await getDocs(q1);
        const gen1 = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let gen2 = [];
        if (gen1.length > 0) {
          const gen1Ids = gen1.map(u => u.id);
          for (let i = 0; i < gen1Ids.length; i += 10) {
            const chunk = gen1Ids.slice(i, i + 10);
            const q2 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap2 = await getDocs(q2);
            gen2.push(...snap2.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        let gen3 = [];
        if (gen2.length > 0) {
          const gen2Ids = gen2.map(u => u.id);
          for (let i = 0; i < gen2Ids.length; i += 10) {
            const chunk = gen2Ids.slice(i, i + 10);
            const q3 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap3 = await getDocs(q3);
            gen3.push(...snap3.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        allUsers = [...gen1, ...gen2, ...gen3];
        _nepAllUsers = allUsers; // cache it
      }
    }

    // gen1: referredBy == 나 / gen2: referredBy ∈ gen1 ids
    let members = [];
    if (gen === 1) {
      members = allUsers.filter(u => u.referredBy === currentUser.uid && u.role !== 'admin');
    } else {
      const gen1ids = allUsers
        .filter(u => u.referredBy === currentUser.uid && u.role !== 'admin')
        .map(u => u.id);
      members = allUsers.filter(u => gen1ids.includes(u.referredBy) && u.role !== 'admin');
    }

    if (!members.length) {
      contentEl.innerHTML = `<div class="empty-state"><i class="fas fa-user-friends"></i><br>${t('emptySubGen').replace('{gen}', gen)}</div>`;
      return;
    }

    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const memberIds = members.map(u => u.id);

    // 멤버별 총 입금(매출) 집계
    const totalDepMap = {}; // lockedBalance (총 매출)
    const chunks = [];
    for (let i = 0; i < memberIds.length; i += 10) chunks.push(memberIds.slice(i, i + 10));
    for (const chunk of chunks) {
      if (!chunk.length) continue;
      try {
        const wq = query(collection(db, 'wallets'), where('userId', 'in', chunk));
        const wSnap = await getDocs(wq);
        wSnap.docs.forEach(d => {
          totalDepMap[d.data().userId || d.id] = (d.data().lockedBalance || 0);
        });
      } catch(e) { console.error("Error fetching (catch err):", e); }
    }

    // 당일 내가 받은 보너스 중 fromUserId가 이 멤버인 것
    const todayMap = {};
    if (memberIds.length > 0) {
      const myBonusQ = query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid));
      const myBonusSnap = await getDocs(myBonusQ);
      let totalRankBonusEarned = 0;
      myBonusSnap.docs.forEach(d => {
        const data = d.data();
        const t = data.type;
        // 판권 매칭 보너스만 취급
        if (!['rank_bonus', 'rank_gap_passthru', 'rank_equal_or_higher_override_1pct', 'rank_equal_or_higher_override'].includes(t)) return;
        
        const amt = data.amountUsdt !== undefined ? data.amountUsdt : (data.amount || 0);
        totalRankBonusEarned += amt; // 누적 판권매칭 수익

        // const data already declared
        const date = data.settlementDate || (data.createdAt?.toDate?.()?.toISOString?.()?.slice(0,10)) || '';
        if (date !== today) return;
        if (!data.fromUserId || !memberIds.includes(data.fromUserId)) return;
        todayMap[data.fromUserId] = (todayMap[data.fromUserId] || 0) + (data.amountUsdt !== undefined ? data.amountUsdt : (data.amount || 0));
      });
    }

    // 멤버별 투자 정보 (ROI 상품명/데일리 이율)
    const investMap = {};
    for (const chunk of chunks) {
      if (!chunk.length) continue;
      try {
        const invQ = query(collection(db, 'investments'), where('userId', 'in', chunk));
        const invSnap = await getDocs(invQ);
        invSnap.docs.forEach(d => {
          const data = d.data();
          if (data.status !== 'active') return;
          const uid = data.userId || d.id;
          if (!investMap[uid]) investMap[uid] = [];
          investMap[uid].push(data);
        });
      } catch(_) {}
    }

    const totalTodayEarn = Object.values(todayMap).reduce((s, v) => s + v, 0);
    const totalSales = Object.values(totalDepMap).reduce((s, v) => s + v, 0);

    // ── 상단 요약 (compact) ──
    const headerHtml = `
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <div style="flex:1;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:8px 6px;text-align:center;">
          <div style="font-size:9px;color:#10b981;margin-bottom:2px;">${gen}대 인원</div>
          <div style="font-size:14px;font-weight:700;color:#10b981;">${members.length}명</div>
        </div>
        <div style="flex:1;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:8px 6px;text-align:center;">
          <div style="font-size:9px;color:#3b82f6;margin-bottom:2px;">당일 내 수익</div>
          <div style="font-size:14px;font-weight:700;color:#3b82f6;">$${fmt(totalTodayEarn)}</div>
        </div>
        <div style="flex:1;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:8px 6px;text-align:center;">
          <div style="font-size:9px;color:#8b5cf6;margin-bottom:2px;">${gen}대 총매출</div>
          <div style="font-size:14px;font-weight:700;color:#8b5cf6;">$${fmt(totalSales)}</div>
        </div>
      </div>
      <!-- 컬럼 헤더 -->
      <div style="display:grid;grid-template-columns:1fr 60px 60px 52px;gap:4px;padding:5px 8px;background:rgba(255,255,255,0.04);border-radius:6px;margin-bottom:4px;">
        <div style="font-size:9px;color:var(--text3,#64748b);font-weight:600;">ID / 상품</div>
        <div style="font-size:9px;color:var(--text3,#64748b);font-weight:600;text-align:right;">당일 수익</div>
        <div style="font-size:9px;color:var(--text3,#64748b);font-weight:600;text-align:right;">총 매출</div>
        <div style="font-size:9px;color:var(--text3,#64748b);font-weight:600;text-align:right;">직급</div>
      </div>`;

    // 멤버 목록 (당일 수익 내림차순)
    const sorted = [...members].sort((a, b) => (todayMap[b.id] || 0) - (todayMap[a.id] || 0));

    const rankColor = { G0:'#94a3b8', G1:'#6b7280', G2:'#10b981', G3:'#3b82f6',
      G4:'#8b5cf6', G5:'#f59e0b', G6:'#ef4444', G7:'#ec4899', G8:'#14b8a6',
      G9:'#f97316', G10:'#eab308' };

    const listHtml = sorted.map((m) => {
      const todayEarn = todayMap[m.id] || 0;
      const totalDep  = totalDepMap[m.id] || 0;
      const rc        = rankColor[m.rank] || '#94a3b8';
      const uid = m.username || (m.email ? m.email.split('@')[0] : m.id.slice(0, 8).toUpperCase());
      const invList   = investMap[m.id] || [];
      // 상품 요약: 가장 큰 투자 상품명+데일리이율 (없으면 '-')
      const mainInv   = invList.sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];
      const prodInfo  = mainInv
        ? `${mainInv.packageName || mainInv.productName || '-'} · ${mainInv.dailyRoi || mainInv.roiPercent || 0}%/d`
        : '-';
      const isOnline = m.lastSeenAt && (Date.now() - m.lastSeenAt < 120000);
      const onlineDot = isOnline ? `<span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%; margin-left:4px; vertical-align:middle; box-shadow:0 0 4px rgba(16,185,129,0.5);"></span>` : '';

      return `
      <div style="display:grid;grid-template-columns:1fr 60px 60px 52px;gap:4px;padding:7px 8px;
        border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;">
        <!-- ID + 상품 -->
        <div style="min-width:0;">
          <div style="font-size:11px;font-weight:700;color:var(--text,#f1f5f9);font-family:monospace;display:flex;align-items:center;">${uid}${onlineDot}</div>
          <div style="font-size:9px;color:var(--text3,#64748b);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${prodInfo}</div>
        </div>
        <!-- 데일리 수익 -->
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:700;color:${todayEarn > 0 ? '#10b981' : 'var(--text3,#64748b)'};">
            ${todayEarn > 0 ? '+$'+fmt(todayEarn) : '-'}
          </div>
        </div>
        <!-- 총 합계(총 입금) -->
        <div style="text-align:right;">
          <div style="font-size:11px;color:var(--text2,#94a3b8);">$${fmt(totalDep)}</div>
        </div>
        <!-- 직급 -->
        <div style="text-align:right;">
          <span style="font-size:10px;background:${rc}22;color:${rc};padding:2px 5px;border-radius:99px;font-weight:700;">${m.rank || 'G0'}</span>
        </div>
      </div>`;
    }).join('');

    contentEl.innerHTML = headerHtml + listHtml;
  } catch(e) {
    console.error('[NEP] gen tab error:', e);
    const msg = e.code === 'permission-denied' || e.message?.includes('Missing or insufficient')
      ? '⚠️ 데이터 접근 권한이 없습니다.<br><small>Firebase 콘솔에서 Firestore 보안 규칙을 배포해 주세요.</small>'
      : `오류: ${e.message || '불러오기 실패'}`;
    contentEl.innerHTML = `<div class="empty-state" style="color:#f87171;">${msg}</div>`;
  }
}


/** 🌐 3대+ 탭 — 대수 구분 없이 전체 매출/수익 요약만 표시 */
async function _loadNepDeepTab(contentEl) {
  contentEl.innerHTML = `<div class="skeleton-item" style="margin-bottom:6px"></div><div class="skeleton-item"></div>`;
  const { collection, query, where, getDocs, limit, db } = window.FB;

  try {
    let allUsers = _nepAllUsers || [];
    if (!allUsers.length) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _nepAllUsers = allUsers;
      } catch (rulesErr) {
        console.warn('[NEP] fallback to manual recursive fetch due to rules error:', rulesErr.message);
        
        // Fallback: Recursive query for gen1, gen2, gen3
        const q1 = query(collection(db, 'users'), where('referredBy', '==', currentUser.uid));
        const snap1 = await getDocs(q1);
        const gen1 = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let gen2 = [];
        if (gen1.length > 0) {
          const gen1Ids = gen1.map(u => u.id);
          for (let i = 0; i < gen1Ids.length; i += 10) {
            const chunk = gen1Ids.slice(i, i + 10);
            const q2 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap2 = await getDocs(q2);
            gen2.push(...snap2.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        let gen3 = [];
        if (gen2.length > 0) {
          const gen2Ids = gen2.map(u => u.id);
          for (let i = 0; i < gen2Ids.length; i += 10) {
            const chunk = gen2Ids.slice(i, i + 10);
            const q3 = query(collection(db, 'users'), where('referredBy', 'in', chunk));
            const snap3 = await getDocs(q3);
            gen3.push(...snap3.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
        
        allUsers = [...gen1, ...gen2, ...gen3];
        _nepAllUsers = allUsers; // cache it
      }
    }

    const genMap = {};
    let queue = allUsers.filter(u => u.referredBy === currentUser.uid && u.role !== 'admin');
    queue.forEach(u => { genMap[u.id] = 1; });
    while (queue.length) {
      const next = [];
      for (const u of queue) {
        const children = allUsers.filter(c => c.referredBy === u.id && c.role !== 'admin');
        children.forEach(c => {
          if (genMap[c.id] === undefined) { genMap[c.id] = genMap[u.id] + 1; next.push(c); }
        });
      }
      queue = next;
    }

    const deepIds = Object.entries(genMap).filter(([, g]) => g >= 3).map(([id]) => id);

    if (!deepIds.length) {
      contentEl.innerHTML = `<div class="empty-state"><i class="fas fa-network-wired"></i><br>${t('emptyDeepGen')}</div>`;
      return;
    }

    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    let totalSales = 0;
    let totalToday = 0;

    // 1) 전체 매출 (locked 총합)
    const chunks = [];
    for (let i = 0; i < deepIds.length; i += 10) chunks.push(deepIds.slice(i, i + 10));
    for (const chunk of chunks) {
      if (!chunk.length) continue;
      try {
        const wQ = query(collection(db, 'wallets'), where('userId', 'in', chunk));
        const wSnap = await getDocs(wQ);
        wSnap.docs.forEach(d => {
          totalSales += (d.data().lockedBalance || 0);
        });
      } catch(_) {}
    }

    // 2) 당일 수익 (판권 매칭)
    const myBQ = query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid));
    const myBS = await getDocs(myBQ);
    myBS.docs.forEach(d => {
      const data = d.data();
      const date = data.settlementDate || (data.createdAt?.toDate?.()?.toISOString?.().slice(0,10)) || '';
      const t = data.type;
      
      // 판권 매칭만 합산
      if (!['rank_bonus', 'rank_gap_passthru', 'rank_equal_or_higher_override_1pct', 'rank_equal_or_higher_override'].includes(t)) return;
      
      if (date === today && deepIds.includes(data.fromUserId)) {
        totalToday += (data.amountUsdt !== undefined ? data.amountUsdt : (data.amount || 0));
      }
    });

    const totalDeep = deepIds.length;

    let html = `
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <div style="flex:1;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:12px 6px;text-align:center;">
          <div style="font-size:10px;color:#10b981;margin-bottom:4px;">3대+ 인원</div>
          <div style="font-size:18px;font-weight:700;color:#10b981;">${totalDeep}명</div>
        </div>
        <div style="flex:1;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:12px 6px;text-align:center;">
          <div style="font-size:10px;color:#3b82f6;margin-bottom:4px;">당일 내 수익</div>
          <div style="font-size:18px;font-weight:700;color:#3b82f6;">$${fmt(totalToday)}</div>
        </div>
        <div style="flex:1;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:12px 6px;text-align:center;">
          <div style="font-size:10px;color:#8b5cf6;margin-bottom:4px;">전체 매출</div>
          <div style="font-size:18px;font-weight:700;color:#8b5cf6;">$${fmt(totalSales)}</div>
        </div>
      </div>
      <div style="text-align:center;padding:20px;color:var(--text3,#64748b);font-size:12px;">
        3대 이하 산하 조직의 전체 통계입니다.
      </div>`;

    contentEl.innerHTML = html;
  } catch(e) {
    console.error('[NEP] deep tab error:', e);
    const msg = e.code === 'permission-denied' || e.message?.includes('Missing or insufficient')
      ? '⚠️ 데이터 접근 권한이 없습니다.<br><small>Firebase 콘솔에서 Firestore 보안 규칙을 배포해 주세요.</small>'
      : `오류: ${e.message || '불러오기 실패'}`;
    contentEl.innerHTML = `<div class="empty-state" style="color:#f87171;">${msg}</div>`;
  }
}

/** 홈 로드 시 미리보기 데이터도 로드 */
const _origLoadRecentTransactions = window.loadRecentTransactions || null;
// 홈 페이지 로드될 때 네트워크 요약도 함께 로드
const _origOnReady = window._onAppReady;
// ═══════════════════════════════════════════════════════════════
// ROI 자동 정산 클라이언트 트리거
// 회원이 앱에 접속했을 때 당일 정산이 누락된 경우 자동으로 실행
// Firestore settlements/{date} 문서로 중복 실행 방지
// ═══════════════════════════════════════════════════════════════
async function checkAndTriggerDailyROI() {
  try {
    const { doc, getDoc, db } = window.FB;

    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    // 이미 정산된 날이면 스킵
    const settlSnap = await getDoc(doc(db, 'settlements', today));
    if (settlSnap.exists()) return;

    // 정산 시각 설정 확인 (UTC 기준)
    const ratesSnap = await getDoc(doc(db, 'rateHistory', 'current'))
      .catch(() => null);
    // rateHistory/current 없으면 settings/rates 시도
    let rates = ratesSnap?.exists() ? ratesSnap.data() : null;
    if (!rates) {
      const r2 = await getDoc(doc(db, 'settings', 'rates')).catch(() => null);
      rates = r2?.exists() ? r2.data() : {};
    }

    // autoSettlement가 꺼져있으면 클라이언트 트리거 스킵
    if (rates.autoSettlement === false) return;

    const targetHour   = rates.autoSettlementHour   ?? 0;
    const targetMinute = rates.autoSettlementMinute ?? 0;
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();

    // 설정된 정산 시각 이후에만 실행 (당일 기준)
    const nowMinutes    = utcH * 60 + utcM;
    const targetMinutes = targetHour * 60 + targetMinute;
    if (nowMinutes < targetMinutes) return;

    // 회원 앱에서는 직접 runDailyROISettlement 호출 불가
    // → Firestore에 pendingSettlement 도큐먼트를 생성하여
    //   admin 스케줄러가 처리하도록 큐에 등록
    const { setDoc, serverTimestamp: sts } = window.FB;
    await setDoc(doc(db, 'pendingSettlements', today), {
      date: today,
      requestedAt: sts(),
      requestedBy: currentUser?.uid || 'client',
      status: 'pending',
    }, { merge: true });

    console.log(`[ROI] 당일(${today}) 정산 요청 큐 등록 완료`);
  } catch(e) {
    // 조용히 실패 (회원 앱 UX에 영향 없음)
    console.warn('[ROI] 정산 트리거 실패:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 홈 화면 - 오늘 수익 요약 카드
// ═══════════════════════════════════════════════════════════════
async function loadTodayEarnCard() {
  try {
    const { collection, query, where, getDocs, limit, db } = window.FB;
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7); // YYYY-MM

    // bonuses 컬렉션에서 내 수익 조회
    const bonusSnap = await getDocs(
      query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid))
    );
    const bonuses = bonusSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 오늘 ROI 수익
    const todayRoi = bonuses
      .filter(b => b.settlementDate === today && (b.type === 'roi_income' || b.type === 'roi'))
      .reduce((s, b) => s + (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)), 0);

    // 오늘 보너스 (네트워크 보너스 등)
    const todayBonus = bonuses
      .filter(b => b.settlementDate === today && (b.type !== 'roi_income' && b.type !== 'roi'))
      .reduce((s, b) => s + (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)), 0);

    // 누적 총 수익 (walletData.totalEarnings 사용)
    const totalEarn = walletData?.totalEarnings || 0;

    // 활성 투자 수 + 일 수익률
    const invSnap = await getDocs(
      query(collection(db, 'investments'), where('userId', '==', currentUser.uid), where('status', '==', 'active'))
    );
    const activeInvests = invSnap.docs.map(d => d.data());
    const totalInvested = activeInvests.reduce((s, i) => s + (i.amount || 0), 0);
    const totalDailyEarn = activeInvests.reduce((s, i) => {
      const rate = (i.roiPercent != null ? i.roiPercent : i.dailyRoi || 0) / 100;
      return s + i.amount * rate;
    }, 0);
    const avgRate = totalInvested > 0 ? (totalDailyEarn / totalInvested * 100) : 0;

    const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

    // 수익이 있는 경우만 카드 표시
    if (todayRoi > 0 || todayBonus > 0 || totalEarn > 0 || activeInvests.length > 0) {
      const card = document.getElementById('todayEarnCard');
      if (card) card.style.display = '';

      setEl('todayEarnDate', today);
      setEl('todayRoiEarn', '$' + fmt(todayRoi));
      setEl('todayBonusEarn', '$' + fmt(todayBonus));
      setEl('totalEarnDisplay', '$' + fmt(totalEarn));
      setEl('todayActiveInvest', activeInvests.length + t('units'));
      setEl('todayDailyRate', avgRate.toFixed(2) + '%');
    }
  } catch(e) {
    console.warn('[todayEarnCard] 로드 실패:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 투자 - 수익 내역 탭
// ═══════════════════════════════════════════════════════════════
async function loadEarnHistoryTab() {
  try {
    const { collection, query, where, getDocs, limit, db } = window.FB;
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const bonusSnap = await getDocs(
      query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid))
    );
    const bonuses = bonusSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // 요약 계산
    const todayRoi   = bonuses.filter(b => b.settlementDate === today && (b.type === 'roi_income' || b.type === 'roi')).reduce((s,b) => s+(b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)),0);
    const totalEarn  = walletData?.totalEarnings || bonuses.reduce((s,b) => s+(b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)),0);
    const monthEarn  = bonuses.filter(b => (b.settlementDate||'').startsWith(thisMonth)).reduce((s,b) => s+(b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)),0);
    const netBonus   = bonuses.filter(b => ['unilevel_bonus','direct_bonus','rank_bonus','center_fee','rank_equal_or_higher_override_1pct','rank_equal_or_higher_override'].includes(b.type)).reduce((s,b) => s+(b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0)),0);

    const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setEl('earnTab_todayRoi',     '$' + fmt(todayRoi));
    setEl('earnTab_totalEarn',    '$' + fmt(totalEarn));
    setEl('earnTab_monthEarn',    '$' + fmt(monthEarn));
    setEl('earnTab_networkBonus', '$' + fmt(netBonus));

    // 목록 렌더
    renderEarnList(bonuses, document.getElementById('earnHistoryList'), '');
  } catch(e) {
    const el = document.getElementById('earnHistoryList');
    if (el) el.innerHTML = `<div class="empty-state">${t('loadFail')}</div>`;
  }
}

window.loadEarnHistory = function() {
  const filter = document.getElementById('earnTypeFilter')?.value || '';
  if (window._earnAllBonuses) renderEarnList(window._earnAllBonuses, document.getElementById('earnHistoryList'), filter);
};

function renderEarnList(bonuses, listEl, typeFilter) {
  if (!listEl) return;
  window._earnAllBonuses = bonuses; // 캐시

  const filtered = typeFilter ? bonuses.filter(b => b.type === typeFilter) : bonuses;
  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state" style="padding:20px 0;">${t('emptyBonus')}</div>`;
    return;
  }

  const typeLabel = {
    roi_income:      t('bonusRoiIncome2'),
    unilevel_bonus:  t('bonusUnilevelBonus'),
    direct_bonus:    t('bonusDirectBonus2'),
    rank_bonus:      t('bonusRankBonus'),
    center_fee:      t('bonusCenterFee'),
    rank_equal_or_higher_override_1pct: '예외(1%) 보너스',
    rank_equal_or_higher_override: '예외 보너스',
    manual_bonus:    t('bonusManual'),
  };

  listEl.innerHTML = filtered.slice(0, 50).map(b => {
    const date = b.settlementDate || (b.createdAt?.seconds ? new Date(b.createdAt.seconds*1000).toLocaleDateString('ko-KR') : '-');
    const label = typeLabel[b.type] || b.type || t('other');
    const amount = b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0);
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;
      background:var(--card,#1e293b);border-radius:12px;margin-bottom:6px;
      border-left:3px solid ${amount > 0 ? '#10b981' : '#64748b'};">
      <div style="width:36px;height:36px;border-radius:10px;
        background:rgba(16,185,129,0.12);display:flex;align-items:center;
        justify-content:center;font-size:16px;flex-shrink:0;">
        ${label.slice(0,2)}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:var(--text,#f1f5f9);">${label}</div>
        <div style="font-size:11px;color:var(--text2,#94a3b8);margin-top:2px;">
          ${b.reason ? b.reason.slice(0,40) : date}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:14px;font-weight:800;color:#10b981;">+$${fmt(amount)}</div>
        <div style="font-size:10px;color:var(--text3,#64748b);">${date}</div>
      </div>
    </div>`;
  }).join('');
}

// cache-bust: ADDRWVJyvNrdHAd2aa8YuVMzRuN4RaxZsemiRZXW2EHu



// ==============================================
// 1. Profit Heatmap (최근 7일 수익 활동)
// ==============================================
window.loadProfitHeatmap = async function() {
  const grid = document.getElementById('profitHeatmapGrid');
  if (!grid || !window.FB || !currentUser) return;
  
  try {
    const { collection, query, where, getDocs, db } = window.FB;
    const now = new Date();
    const past7 = new Date(now.getTime() - 7 * 86400000);
    
    // 유저의 7일간 수익 가져오기
    const q = query(
      collection(db, 'bonuses'),
      where('userId', '==', currentUser.uid),
      where('createdAt', '>=', past7)
    );
    const snap = await getDocs(q);
    
    // 날짜별 수익 맵 생성
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    
    snap.docs.forEach(d => {
      const b = d.data();
      if (!b.createdAt) return;
      const t = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const dateStr = t.toISOString().slice(0, 10);
      if (dailyMap[dateStr] !== undefined && (b.type === 'daily_roi' || b.type === 'roi' || b.type === 'roi_income' || b.type === 'rank_bonus' || b.type === 'match_bonus')) {
        dailyMap[dateStr] += (b.amountUsdt !== undefined ? b.amountUsdt : (b.amount || 0));
      }
    });
    
    let html = '';
    const days = Object.keys(dailyMap).sort();
    
    days.forEach(dateStr => {
      const earn = dailyMap[dateStr];
      let colorClass = 'heatmap-box-0'; // none
      if (earn > 0 && earn < 10) colorClass = 'heatmap-box-1'; // light
      else if (earn >= 10 && earn < 50) colorClass = 'heatmap-box-2'; // med
      else if (earn >= 50 && earn < 200) colorClass = 'heatmap-box-3'; // high
      else if (earn >= 200) colorClass = 'heatmap-box-4'; // max
      
      const dayLabel = parseInt(dateStr.slice(8, 10)) + '일';
      html += `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          <div class="${colorClass}" style="width:24px; height:24px; border-radius:4px; transition:all 0.2s;" title="${dateStr}: $${earn.toFixed(2)}"></div>
          <span style="font-size:9px; color:rgba(255,255,255,0.4);">${dayLabel}</span>
        </div>
      `;
    });
    
    grid.innerHTML = html;
    
  } catch (e) {
    grid.innerHTML = '<div style="text-align:center; font-size:10px; color:#64748b;">정보 없음</div>';
  }
};

// ==============================================
// 2. Live Transaction Marquee
// ==============================================
window.initLiveTransactionMarquee = async function() {
  const container = document.getElementById('marqueeContainer');
  if (!container || !window.FB) return;
  
  try {
    const { collection, query, limit, getDocs, db, orderBy } = window.FB;
    
    // 모든 유저의 최근 입금/출금/투자/수익 기록 가져오기 (가장 최신 10개)
    // 인덱스 문제 방지를 위해 단순 정렬 (또는 전체 불러와 정렬 후 자름)
    let txs = [];
    try {
      const q = query(collection(db, 'transactions'), limit(15));
      const snap = await getDocs(q);
      txs = snap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter(t => t.status === 'approved' || !t.status)
        .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 10);
    } catch(err) {
      console.warn('Live tx query denied, using dummy data');
    }
      
    // 거래내역이 아예 없으면 가짜 데이터라도 생성
    if (txs.length < 5) {
      const dummy = [
        { type: 'deposit', amount: 500, userEmail: 'al***@gmail.com', createdAt: {seconds: Date.now()/1000 - 300} },
        { type: 'withdrawal', amount: 120, userEmail: 'ch***@naver.com', createdAt: {seconds: Date.now()/1000 - 800} },
        { type: 'invest', amount: 3000, userEmail: 'ko***@gmail.com', createdAt: {seconds: Date.now()/1000 - 1500} },
        { type: 'deposit', amount: 10000, userEmail: 'pa***@daum.net', createdAt: {seconds: Date.now()/1000 - 3600} },
        { type: 'bonus', amount: 45.5, userEmail: 'mi***@gmail.com', createdAt: {seconds: Date.now()/1000 - 4000} }
      ];
      txs = [...txs, ...dummy];
    }
    
    const types = { 
      'deposit': { icon: '📥', color: '#10b981', label: '입금' },
      'withdrawal': { icon: '📤', color: '#f43f5e', label: '출금' },
      'invest': { icon: '💼', color: '#6366f1', label: '투자' },
      'bonus': { icon: '🎁', color: '#f59e0b', label: '수익' },
      'game': { icon: '🎮', color: '#8b5cf6', label: '게임' }
    };
    
    const formatEmail = (email) => {
      if (!email) return 'User***';
      const pts = email.split('@');
      if (pts.length !== 2) return email.substring(0,3) + '***';
      return pts[0].substring(0,2) + '***@' + pts[1];
    };
    
    // Marquee 루프 렌더링
    const renderTxs = () => {
      container.innerHTML = txs.map(tx => {
        const info = types[tx.type] || { icon: '⚡', color: '#94a3b8', label: '시스템' };
        const amountStr = tx.amount ? `$${parseFloat(tx.amount).toLocaleString()}` : '';
        return `
          <div style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; font-size:12px;">
            <div style="width:28px; height:28px; border-radius:50%; background:${info.color}20; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">
              ${info.icon}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="color:rgba(255,255,255,0.9); font-weight:500; display:flex; justify-content:space-between;">
                <span>${formatEmail(tx.userEmail || tx.userId)}</span>
                <span style="color:${info.color};">${amountStr}</span>
              </div>
              <div style="color:rgba(255,255,255,0.5); font-size:10px; margin-top:2px;">
                ${info.label} 완료
              </div>
            </div>
          </div>
        `;
      }).join('');
    };
    
    renderTxs();
    
    // 애니메이션 셋팅 (CSS)
    let offset = 0;
    const itemHeight = 44 + 8; // approx item height + gap
    
    setInterval(() => {
      offset -= 0.5; // scroll up speed
      if (Math.abs(offset) >= itemHeight) {
        // move first item to end
        txs.push(txs.shift());
        renderTxs();
        offset = 0;
        container.style.transition = 'none';
        container.style.transform = `translateY(0px)`;
        // force reflow
        void container.offsetHeight;
      } else {
        container.style.transition = 'transform 0.1s linear';
        container.style.transform = `translateY(${offset}px)`;
      }
    }, 50);
    
  } catch (e) {
    console.log("Marquee error:", e);
  }
};


// ==============================================
// 🖱️ Draggable Map Utility
// ==============================================
window.makeDraggableMap = function(ele) {
    if (!ele || ele._dragInit) return;
    ele._dragInit = true;
    ele.style.cursor = 'grab';
    
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;
    let isDragging = false;

    // Prevent native dragging
    ele.addEventListener('dragstart', (e) => e.preventDefault());

    // Mouse Events
    ele.addEventListener('mousedown', (e) => {
        isDown = true;
        ele.style.cursor = 'grabbing';
        isDragging = false;
        startX = e.pageX - ele.offsetLeft;
        startY = e.pageY - ele.offsetTop;
        scrollLeft = ele.scrollLeft;
        scrollTop = ele.scrollTop;
    });

    ele.addEventListener('mouseleave', () => {
        isDown = false;
        ele.style.cursor = 'grab';
    });

    ele.addEventListener('mouseup', () => {
        isDown = false;
        ele.style.cursor = 'grab';
    });

    ele.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault(); 
        const x = e.pageX - ele.offsetLeft;
        const y = e.pageY - ele.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        
        if (Math.abs(walkX) > 3 || Math.abs(walkY) > 3) {
            isDragging = true;
        }
        ele.scrollLeft = scrollLeft - walkX;
        ele.scrollTop = scrollTop - walkY;
    });

    // Touch Events
    ele.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - ele.offsetLeft;
        startY = e.touches[0].pageY - ele.offsetTop;
        scrollLeft = ele.scrollLeft;
        scrollTop = ele.scrollTop;
    }, {passive: true});

    ele.addEventListener('touchend', () => {
        isDown = false;
    });

    ele.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX - ele.offsetLeft;
        const y = e.touches[0].pageY - ele.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        ele.scrollLeft = scrollLeft - walkX;
        ele.scrollTop = scrollTop - walkY;
    }, {passive: true});

    // Click suppression if dragged
    ele.addEventListener('click', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
        }
    }, true);
};


window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        let ref = params.get('ref') || params.get('referral') || params.get('code');
        if (ref) localStorage.setItem('saved_ref_code', ref);
        else ref = localStorage.getItem('saved_ref_code');
        
        if (ref) {
            const el = document.getElementById('regReferral');
            if (el) {
                el.value = ref;
                if (typeof showRefCodeHint === 'function') showRefCodeHint(ref);
                if (typeof window.switchAuthTab === 'function') window.switchAuthTab('register');
            }
        }

        let action = params.get('action');
        if (action) localStorage.setItem('saved_action', action);
        else {
            action = localStorage.getItem('saved_action');
            localStorage.removeItem('saved_action');
        }
        
        if (action === 'deposit' && currentUser) {
            if (typeof showDepositModal === 'function') showDepositModal();
        } else if (action === 'withdraw' && currentUser) {
            if (typeof showWithdrawModal === 'function') showWithdrawModal();
        }
    }, 1500);
});

if (typeof window._pendingAuthUser !== 'undefined' && typeof window.onAuthReady === 'function') {
  window.onAuthReady(window._pendingAuthUser);
  delete window._pendingAuthUser;
}

setTimeout(() => {
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
    if (typeof window.showScreen === 'function') window.showScreen('auth');
    else {
        loadingScreen.classList.add('hidden');
        const authScreen = document.getElementById('authScreen');
        if (authScreen) authScreen.classList.remove('hidden');
    }
  }
}, 3000);

window.showCacheClearGuide = function() {
    const modal = document.createElement('div');
    modal.className = 'cache-modal-wrap';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.8)';
    modal.style.zIndex = '10000';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = `
        <div style="background:var(--card-bg, #1e293b); padding:24px; border-radius:16px; max-width:90%; width:320px; border:1px solid rgba(255,255,255,0.1);">
            <div style="font-size:18px; font-weight:bold; color:#fff; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                <span>🧹</span> 캐시 삭제 안내 (안드로이드)
            </div>
            <div style="color:#cbd5e1; font-size:14px; line-height:1.6; margin-bottom:20px;">
                앱 접속이나 화면 로딩에 문제가 발생할 경우 아래 순서대로 캐시를 삭제해주세요:<br><br>
                1. 화면 우측 상단의 <b>더보기(⋮)</b> 메뉴 터치<br>
                2. <b>[설정]</b> 선택<br>
                3. <b>[개인정보 보호 및 보안]</b> 선택<br>
                4. <b>[인터넷 사용 기록 삭제]</b> 선택<br>
                5. 기간을 <b>[전체 기간]</b>으로 설정<br>
                6. <b>[쿠키 및 사이트 데이터]</b>와 <b>[캐시된 이미지 및 파일]</b> 체크<br>
                7. <b>[인터넷 사용 기록 삭제]</b> 버튼 터치<br>
                8. 브라우저를 닫고 다시 DEEDRA에 접속<br>
            </div>
            <button onclick="this.closest('.cache-modal-wrap').remove()" style="width:100%; padding:12px; border-radius:10px; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#fff; border:none; font-weight:bold; cursor:pointer;">확인</button>
        </div>
    `;
    document.body.appendChild(modal);
};


// ===== DEX Swap Modal =====
window.openDexSwap = function(type) {
  const usdtMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const ddraMint = "DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv";
  
  let inputMint = type === 'buy' ? usdtMint : ddraMint;
  let outputMint = type === 'buy' ? ddraMint : usdtMint;
  
  const url = `https://raydium.io/swap/?inputMint=${inputMint}&outputMint=${outputMint}&fixed=in`;
  
  const modal = document.getElementById('dexModal');
  const iframe = document.getElementById('dexIframe');
  
  if (modal && iframe) {
    iframe.src = url;
    modal.classList.remove('hidden');
  } else {
    window.open(url, '_blank');
  }
};
// ===== 실시간 암호화폐 시세 (Upbit) =====
function startUpbitTicker() {
  const container = document.getElementById('upbitTickerContainer');
  if (!container) return;
  
  const coinList = [
    {id:'KRW-BTC', sym:'BTC', name:'Bitcoin'},
    {id:'KRW-ETH', sym:'ETH', name:'Ethereum'},
    {id:'KRW-SOL', sym:'SOL', name:'Solana'},
    {id:'KRW-XRP', sym:'XRP', name:'Ripple'},
    {id:'KRW-DOGE', sym:'DOGE', name:'Dogecoin'},
    {id:'KRW-ADA', sym:'ADA', name:'Cardano'},
    {id:'KRW-AVAX', sym:'AVAX', name:'Avalanche'},
    {id:'KRW-DOT', sym:'DOT', name:'Polkadot'},
    {id:'KRW-LINK', sym:'LINK', name:'Chainlink'},
    {id:'KRW-TRX', sym:'TRX', name:'Tron'},
    {id:'KRW-BCH', sym:'BCH', name:'Bitcoin Cash'},
    {id:'KRW-ETC', sym:'ETC', name:'Ethereum Classic'},
    {id:'KRW-SUI', sym:'SUI', name:'Sui'},
    {id:'KRW-STX', sym:'STX', name:'Stacks'},
    {id:'KRW-SEI', sym:'SEI', name:'Sei'},
    {id:'KRW-ARB', sym:'ARB', name:'Arbitrum'},
    {id:'KRW-OP', sym:'OP', name:'Optimism'},
    {id:'KRW-NEAR', sym:'NEAR', name:'NEAR Protocol'},
    {id:'KRW-APT', sym:'APT', name:'Aptos'},
    {id:'KRW-AAVE', sym:'AAVE', name:'Aave'},
    {id:'KRW-SHIB', sym:'SHIB', name:'Shiba Inu'},
    {id:'KRW-SAND', sym:'SAND', name:'The Sandbox'},
    {id:'KRW-MANA', sym:'MANA', name:'Decentraland'},
    {id:'KRW-AXS', sym:'AXS', name:'Axie Infinity'}
  ];
  
  let pageIndex = 0;
  let cachedData = {};
  
  async function fetchPrices() {
    try {
      const ids = coinList.map(c => c.id).join(',');
      const res = await fetch('/api/upbit-ticker?markets=' + ids);
      const data = await res.json();
      
      if (!Array.isArray(data)) {
        console.error('Upbit API Error:', data);
        return;
      }
      
      data.forEach(ticker => {
        cachedData[ticker.market] = ticker;
      });
      renderTickers();
    } catch(e) {
      console.warn('Upbit ticker fetch error:', e);
    }
  }
  
  function renderTickers() {
    if (Object.keys(cachedData).length === 0) return;
    
    // Rotate every fetch (every 5 seconds) -> move pageIndex by 1
    pageIndex = (pageIndex + 1) % 3; // 24 coins / 8 per page = 3 pages
    
    const startIndex = pageIndex * 8;
    const currentCoins = coinList.slice(startIndex, startIndex + 8);
    
    let html = '';
    currentCoins.forEach(coin => {
      const ticker = cachedData[coin.id];
      if (!ticker) return;
      
      const isUp = ticker.change === 'RISE';
      const isDown = ticker.change === 'FALL';
      const color = isUp ? '#ef4444' : isDown ? '#3b82f6' : '#94a3b8';
      const sign = isUp ? '+' : '';
      const pct = (ticker.signed_change_rate * 100).toFixed(2);
      
      let priceStr = ticker.trade_price.toLocaleString();
      if (ticker.trade_price < 100) {
        priceStr = ticker.trade_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});
      }
      
      html += `
        <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); animation: fadeIn 0.5s ease;">
          <div style="font-size:10px; color:#94a3b8; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fff; font-weight:700; font-size:12px;">${coin.sym}</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%; text-align:right;">${coin.name}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <span style="font-size:14px; font-weight:800; color:${color}">${priceStr}</span>
            <span style="font-size:11px; font-weight:600; color:${color}">${sign}${pct}%</span>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }
  
  // Inject fadeIn animation CSS if not exists
  if (!document.getElementById('tickerAnimStyle')) {
    const style = document.createElement('style');
    style.id = 'tickerAnimStyle';
    style.innerHTML = '@keyframes fadeIn { from { opacity: 0.3; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }';
    document.head.appendChild(style);
  }
  
  fetchPrices();
  setInterval(fetchPrices, 5000);
}

setTimeout(startUpbitTicker, 2000);


window.updateAutoCompoundUI = function(isAcChecked) {
  const icon = document.getElementById('autoCompoundIcon');
  const title = document.getElementById('autoCompoundTitleText');
  const sw = document.getElementById('autoCompoundSwitch');
  if(sw) sw.checked = isAcChecked;
  
  if (isAcChecked) {
    if(icon) {
      icon.style.color = '#10b981';
      icon.classList.add('fa-spin');
    }
    if(title) {
      title.style.color = '#10b981';
    }
  } else {
    if(icon) {
      icon.style.color = '#64748b';
      icon.classList.remove('fa-spin');
    }
    if(title) {
      title.style.color = 'var(--text-color, #fff)';
    }
  }
};

window.toggleAutoCompound = function(el) {
  if (!userData) {
    el.checked = !el.checked;
    return;
  }
  
  const isChecked = el.checked;
  if (isChecked) {
    el.checked = false;
    const agreeCheck = document.getElementById('autoCompoundAgreeCheck');
    const btnConfirm = document.getElementById('btnConfirmAutoCompound');
    if (agreeCheck) {
      agreeCheck.checked = false;
      agreeCheck.onchange = function() {
        btnConfirm.disabled = !this.checked;
        btnConfirm.style.opacity = this.checked ? '1' : '0.5';
      };
    }
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.style.opacity = '0.5';
    }
    document.getElementById('autoCompoundModal').classList.remove('hidden');
  } else {
    if (confirm('자동 복리 기능을 정말 해제하시겠습니까? (이후 데일리 수익은 출금 가능한 상태로 적립됩니다)')) {
      updateUserAutoCompound(false);
    } else {
      el.checked = true;
    }
  }
};

window.confirmAutoCompound = function() {
  closeModal('autoCompoundModal');
  updateUserAutoCompound(true);
};

window.updateUserAutoCompound = async function(isAcChecked) {
  try {
    let idToken = window.FB && window.FB._idToken ? window.FB._idToken : '';
    let currentUser = null;
    if (typeof window.FB !== 'undefined' && window.FB.auth && window.FB.auth.currentUser) {
        currentUser = window.FB.auth.currentUser;
    } else if (typeof window.auth !== 'undefined' && window.auth.currentUser) {
        currentUser = window.auth.currentUser;
    } else if (typeof auth !== 'undefined' && auth.currentUser) {
        currentUser = auth.currentUser;
    }
    if (currentUser && typeof currentUser.getIdToken === 'function') {
        idToken = await currentUser.getIdToken();
    } else if (window.FB && window.FB._idToken) {
        idToken = window.FB._idToken;
    }

    if (!idToken) throw new Error('인증 토큰이 없습니다. 다시 로그인 해주세요.');

    const res = await fetch('/api/user/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + idToken
      },
      body: JSON.stringify({ autoCompound: isAcChecked })
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'API request failed');
    }

    if (userData) userData.autoCompound = isAcChecked;
    updateAutoCompoundUI(isAcChecked);
    showToast(isAcChecked ? '자동 복리가 활성화되었습니다.' : '자동 복리가 해제되었습니다.', 'success');
  } catch (err) {
    console.error('Auto compound update error:', err);
    showToast('설정 변경 실패: ' + err.message, 'error');
    updateAutoCompoundUI(!isAcChecked); // revert UI
  }
};




window.hardRefresh = async function() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const names = await caches.keys();
      for (let name of names) {
        await caches.delete(name);
      }
    }
  } catch (e) {
    console.error('Cache clear error:', e);
  }
  // Remove existing query params and add a timestamp
  const url = new URL(window.location.href);
  url.searchParams.set('t', new Date().getTime());
  window.location.href = url.toString();
};


// ══════════════════════════════════════════════════════════════════
// 실시간 접속자 수 시뮬레이션 (시간대별 더 정교한 로직 & 자동 실행)
// ══════════════════════════════════════════════════════════════════
let liveUserCount = 0;
let liveUserTrendCount = 0;
let currentLiveTrend = 1;

function initLiveUsers() {
    const now = new Date();
    const h = now.getHours();
    
    // 주간(09:00~17:00)은 120~200 사이
    // 그 외 시간은 15~60 사이
    let baseCount = 15;
    if (h >= 9 && h < 17) {
        // 시간에 따라 조금씩 달라지는 기본 베이스 (예: 9시는 120근처, 13시는 180근처 등 자연스럽게)
        // 여기선 120~180 정도로 잡아서 위로 튀어도 200 안 넘게 설정
        baseCount = Math.floor(Math.random() * 40) + 130; 
    } else {
        baseCount = Math.floor(Math.random() * 20) + 20;
    }
    
    liveUserCount = baseCount;
    updateLiveUserUI();

    // 시작 후 1초 뒤부터 변동 시작
    setTimeout(updateLiveUserLogic, Math.floor(Math.random() * 1500) + 1000);
}

function updateLiveUserUI() {
    const elHome = document.getElementById('homeLiveCount');
    const elNet = document.getElementById('networkLiveCount');
    if (elHome) elHome.textContent = liveUserCount;
    if (elNet) elNet.textContent = liveUserCount;
}

function updateLiveUserLogic() {
    const now = new Date();
    const h = now.getHours();
    
    // 최대치 제한 (낮 120~200, 밤 15~60)
    let minCount = (h >= 9 && h < 17) ? 120 : 15;
    let maxCount = (h >= 9 && h < 17) ? 198 : 60;

    if (liveUserTrendCount <= 0) {
        // 추세 전환 (플러스 2~3회, 마이너스 2~3회 등 불규칙)
        currentLiveTrend = Math.random() > 0.5 ? 1 : -1;
        liveUserTrendCount = Math.floor(Math.random() * 3) + 2; 
    }
    
    liveUserTrendCount--;

    // 변동폭: 1 ~ 3명
    let magnitude = Math.floor(Math.random() * 3) + 1;
    let change = currentLiveTrend * magnitude;
    
    // 가끔 튀는 값 (현실감을 위해 한 번씩 역방향으로 1명 튐)
    if (Math.random() > 0.8) {
        change = -1 * Math.sign(change) * 1;
    }

    liveUserCount += change;
    
    // 범위 이탈 방지 강제 보정
    if (liveUserCount <= minCount) {
        liveUserCount = minCount + Math.floor(Math.random() * 3);
        currentLiveTrend = 1; // 오름세로 즉시 전환
        liveUserTrendCount = 2;
    }
    if (liveUserCount >= maxCount) {
        liveUserCount = maxCount - Math.floor(Math.random() * 3);
        currentLiveTrend = -1; // 내림세로 즉시 전환
        liveUserTrendCount = 2;
    }

    updateLiveUserUI();
    
    // 2초 ~ 6초 사이 불규칙 간격 (초침처럼 움직이지 않도록 완전 랜덤)
    const nextInterval = Math.floor(Math.random() * 4000) + 2000;
    setTimeout(updateLiveUserLogic, nextInterval);
}

// 스크립트가 로드되면 바로, 그리고 DOM이 준비되면 한 번 더 확실하게 실행
setTimeout(() => {
    if(liveUserCount === 0) initLiveUsers();
}, 500);

window.addEventListener('DOMContentLoaded', () => {
    if(liveUserCount === 0) initLiveUsers();
});

// Add these to app.js
window.showWalletRegisterModal = function() {
    const pinGroup = document.getElementById('walletPinGroup');
    const pinInput = document.getElementById('walletPinInput');
    
    if (userData && userData.solanaWallet) {
        document.getElementById('solanaWalletInput').value = userData.solanaWallet;
        if (pinGroup) pinGroup.classList.remove('hidden');
        if (pinInput) pinInput.value = '';
    } else {
        document.getElementById('solanaWalletInput').value = '';
        if (pinGroup) pinGroup.classList.add('hidden');
        if (pinInput) pinInput.value = '';
    }
    document.getElementById('walletRegisterModal').classList.remove('hidden');
};

window.saveWalletAddress = async function() {
    const address = document.getElementById('solanaWalletInput').value.trim();
    if (!address) {
        showToast('지갑 주소를 입력해주세요.', 'error');
        return;
    }
    
    // Solana address basic validation (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        showToast('유효한 솔라나 지갑 주소가 아닙니다.', 'error');
        return;
    }
    
    const btn = document.getElementById('saveWalletBtn');
    const originalText = btn.innerText;
    
    let currentPin = '';
    const isChanging = userData && userData.solanaWallet && userData.solanaWallet !== address;
    if (isChanging) {
        const pinInput = document.getElementById('walletPinInput');
        currentPin = pinInput ? pinInput.value.trim() : '';
        if (!currentPin || currentPin.length !== 6) {
            showToast('변경을 위해 출금 PIN 6자리를 입력해주세요.', 'error');
            return;
        }
    }
    
    btn.disabled = true;
    btn.innerText = '저장 중...';
    
    try {
        let idToken = window.FB && window.FB._idToken ? window.FB._idToken : '';
        let currentUser = null;
        if (typeof window.FB !== 'undefined' && window.FB.auth && window.FB.auth.currentUser) {
            currentUser = window.FB.auth.currentUser;
        } else if (typeof window.auth !== 'undefined' && window.auth.currentUser) {
            currentUser = window.auth.currentUser;
        } else if (typeof auth !== 'undefined' && auth.currentUser) {
            currentUser = auth.currentUser;
        }
        if (currentUser && typeof currentUser.getIdToken === 'function') {
            idToken = await currentUser.getIdToken();
        } else if (window.FB && window.FB._idToken) {
            idToken = window.FB._idToken;
        }
        
        if (!idToken) throw new Error('인증 토큰이 없습니다. 다시 로그인 해주세요.');
        
        const res = await fetch('/api/user/update-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ solanaWallet: address, currentPin: currentPin })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('지갑 주소가 성공적으로 저장되었습니다.', 'success');
            if (userData) {
                userData.solanaWallet = address;
            }
            closeModal('walletRegisterModal');
        } else {
            showToast(data.error || '저장에 실패했습니다.', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
        if (btn) { btn.disabled = false; }
        btn.innerText = originalText;
    }
};

// ----- 팟캐스트 로드 -----
window.loadUserPodcasts = async function() {
  const wrap = document.getElementById('userPodcastList');
  if (!wrap) return;
  
  try {
    const res = await fetch('/api/podcasts');
    const data = await res.json();
    
    if (!data.success || !data.data || data.data.length === 0) {
      wrap.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text2); font-size:13px; background:var(--bg2); border-radius:12px;">등록된 콘텐츠(음성·영상)가 없습니다.</div>`;
      return;
    }
    
    let html = '';
    data.data.forEach(p => {
      const date = p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '';
      
      let mediaHtml = '';
      if (p.audioUrl) {
        const lowerUrl = p.audioUrl.toLowerCase();
        const isVideo = lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.mov') || lowerUrl.includes('.mp4?') || lowerUrl.includes('.webm?') || lowerUrl.includes('.mov?');
        
        if (isVideo) {
          mediaHtml = `<video controls playsinline src="${p.audioUrl}" style="width:100%; border-radius:8px; outline:none; background:#000; max-height: 250px;"></video>`;
        } else {
          mediaHtml = `<audio controls src="${p.audioUrl}" style="width:100%; height:36px; outline:none;"></audio>`;
        }
      }

      html += `
      <div style="background:var(--bg2); border-radius:12px; padding:16px; margin-bottom:12px; border:1px solid var(--border);">
        <div style="font-size:12px; color:var(--text2); margin-bottom:6px;">${date}</div>
        <div style="font-size:15px; font-weight:700; color:var(--text); margin-bottom:10px;">${p.title}</div>
        <div style="font-size:13px; color:var(--text2); margin-bottom:16px; line-height:1.4;">${p.description || ''}</div>
        <div style="background:var(--bg); border-radius:8px; padding:10px;">
          ${mediaHtml}
        </div>
      </div>`;
    });
    
    wrap.innerHTML = html;
  } catch (error) {
    console.error(error);
    wrap.innerHTML = `<div style="text-align:center; padding:20px; color:var(--red);">불러오기 실패: ${error.message}</div>`;
  }
};

window.showFullscreenChart = function() {
  const pairAddress = typeof _livePrice_pair !== 'undefined' ? _livePrice_pair : 'CCWoFvKBpLLykQZs3YBaAFGG7qS9aztSCYq5L1AY6S9c';
  window.open(`https://dexscreener.com/solana/${pairAddress}`, '_blank');
};

// ==========================================
// [뒤로가기 및 이탈 방어 시스템 (Max Level)]
// ==========================================
function enforceBackButtonJail() {
    if (window.__backJailActive) return;
    window.__backJailActive = true;

    // 1. History Stack Hijacking (히스토리 스택 탈취)
    // 현재 상태를 히스토리에 2번 밀어넣어 뒤로가기 클릭 시 이전 페이지가 아닌 '현재 페이지'로 이동하게 만듭니다.
    history.pushState({ page: 1 }, "title 1", location.href);
    history.pushState({ page: 2 }, "title 2", location.href);

    // 2. popstate 이벤트 가로채기 (뒤로가기 버튼 감지)
    window.addEventListener('popstate', function(event) {
        // 뒤로가기가 감지되면 다시 강제로 히스토리를 앞으로 밀어버립니다.
        history.pushState({ page: 3 }, "title 3", location.href);
        
        // (선택) 경고창 띄우기 (모바일에서는 모달 등을 띄우는 용도로 사용 가능)
        // alert("이 페이지에서는 뒤로가기를 사용할 수 없습니다.");
    });

    // 3. 브라우저 이탈 방지 (새로고침, 창 닫기, 외부 링크 이동 방어)
    window.addEventListener('beforeunload', function(e) {
        // 커스텀 메시지는 최신 브라우저에서 무시되지만, 기본 브라우저 경고창을 띄우게 만듭니다.
        var confirmationMessage = '정말 나가시겠습니까?';
        e.preventDefault(); // 표준 표준 방식
        (e || window.event).returnValue = confirmationMessage; // 구형 브라우저 호환
        return confirmationMessage;
    });

    // 4. 모바일/터치 디바이스에서의 스와이프 뒤로가기 방어
    document.addEventListener('touchstart', function(e) {
        if (e.touches[0].pageX < 20) { // 화면 왼쪽 끝에서 스와이프하는 제스처 방어
            e.preventDefault();
        }
    }, { passive: false });
}

// 브라우저 정책상 사용자 상호작용(클릭, 터치)이 있어야 beforeunload 등이 100% 작동하므로,
// 화면의 아무 곳이나 클릭/터치하면 즉시 방어 모드가 가동되도록 설정
document.addEventListener('click', enforceBackButtonJail, { once: true });
document.addEventListener('touchstart', enforceBackButtonJail, { once: true });

// 즉시 실행 (History 방어는 상호작용 없이도 일부 작동)
enforceBackButtonJail();
