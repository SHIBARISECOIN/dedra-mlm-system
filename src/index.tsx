import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Static files
app.use('/static/*', serveStatic({ root: './' }))

// 테스트 계정 생성 페이지
app.get('/setup', (c) => c.html(SETUP_HTML()))

// ─── Main App (SPA) ───────────────────────────────────────────────────────────
const HTML = () => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>DEEDRA</title>
  <link rel="icon" href="/static/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body>
<div id="app">

  <!-- ===== 로딩 화면 ===== -->
  <div id="loadingScreen" class="loading-screen">
    <img src="/static/logo-banner.png" class="loading-banner" alt="DEEDRA" />
    <div class="spinner"></div>
  </div>

  <!-- ===== 인증 화면 ===== -->
  <div id="authScreen" class="screen hidden">
    <div class="auth-container">
      <div class="auth-logo">
        <img src="/static/logo-banner.png" class="auth-banner-img" alt="DEEDRA" />
      </div>
      <div class="auth-form-wrap">
        <p class="auth-tagline">🔐 안전하고 스마트한 가상자산 투자</p>
        <div class="auth-tabs">
          <button class="auth-tab active" id="loginTab" onclick="switchAuthTab('login')">로그인</button>
          <button class="auth-tab" id="registerTab" onclick="switchAuthTab('register')">회원가입</button>
        </div>

        <!-- 로그인 폼 -->
        <div id="loginForm">
          <div class="form-group">
            <label class="form-label">이메일</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="이메일을 입력하세요" />
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="비밀번호를 입력하세요" />
          </div>
          <button class="btn btn-primary btn-full mt-8" onclick="handleLogin()">
            <i class="fas fa-sign-in-alt"></i> 로그인
          </button>
          <button class="btn btn-ghost btn-full mt-8" onclick="handleForgotPassword()" style="font-size:14px">
            비밀번호를 잊으셨나요?
          </button>
        </div>

        <!-- 회원가입 폼 -->
        <div id="registerForm" class="hidden">
          <div class="form-group">
            <label class="form-label">이름</label>
            <input type="text" id="regName" class="form-input" placeholder="이름을 입력하세요" />
          </div>
          <div class="form-group">
            <label class="form-label">이메일</label>
            <input type="email" id="regEmail" class="form-input" placeholder="이메일을 입력하세요" />
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호</label>
            <input type="password" id="regPassword" class="form-input" placeholder="8자리 이상 입력하세요" />
          </div>
          <div class="form-group">
            <label class="form-label">추천인 코드 <span class="required">* 필수</span></label>
            <input type="text" id="regReferral" class="form-input" placeholder="추천인 코드를 입력하세요" />
          </div>
          <button class="btn btn-primary btn-full mt-8" onclick="handleRegister()">
            <i class="fas fa-user-plus"></i> 회원가입
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== 메인 앱 ===== -->
  <div id="mainApp" class="screen hidden">

    <!-- 상단 헤더 -->
    <div class="app-header">
      <div class="header-left">
        <img src="/static/logo-banner.png" class="header-logo-img" alt="DEEDRA" />
      </div>
      <div class="header-right">
        <button class="icon-btn" onclick="toggleTheme()" id="themeBtn" title="테마 변경">
          <i class="fas fa-moon" id="themeIcon"></i>
        </button>
        <button class="icon-btn" onclick="showNotifications()">
          <i class="fas fa-bell"></i>
          <span class="badge-dot hidden" id="notiBadge"></span>
        </button>
      </div>
    </div>

    <!-- 페이지 컨테이너 -->
    <div class="page-container" id="pageContainer">

      <!-- ======== HOME 페이지 ======== -->
      <div id="homePage" class="page active">
        <div class="page-scroll">

          <!-- 인사 -->
          <div class="greeting-section">
            <div>
              <div class="greeting-text" id="greetingMsg">안녕하세요 👋</div>
              <div class="greeting-name" id="userNameDisplay">-</div>
            </div>
            <div class="rank-badge" id="userRankBadge">G0</div>
          </div>

          <!-- 총 자산 카드 -->
          <div class="asset-main-card">
            <div class="asset-total-label">총 자산 (USD 환산)</div>
            <div class="asset-total-amount" id="totalAsset">$0.00</div>
            <div class="asset-total-sub" id="totalAssetKrw">≈ ₩0</div>

            <!-- 원금/이자 분리 -->
            <div class="asset-split-row">
              <div class="asset-split-item">
                <div class="asset-split-icon">🔒</div>
                <div class="asset-split-label">USDT 원금 (잠금)</div>
                <div class="asset-split-value" id="splitUsdt">0.00</div>
                <div class="asset-split-sub">투자 중</div>
              </div>
              <div class="asset-split-item">
                <div class="asset-split-icon">💎</div>
                <div class="asset-split-label">DEEDRA 이자 (출금 가능)</div>
                <div class="asset-split-value" id="splitDedra">0.00</div>
                <div class="asset-split-sub" id="splitDedraUsd">≈ $0.00</div>
              </div>
            </div>

            <!-- 입출금 버튼 -->
            <div class="asset-action-row">
              <button class="asset-action-btn deposit" onclick="showDepositModal()">
                <i class="fas fa-arrow-down"></i> USDT 입금
              </button>
              <button class="asset-action-btn withdraw" onclick="showWithdrawModal()">
                <i class="fas fa-arrow-up"></i> DEEDRA 출금
              </button>
            </div>
          </div>

          <!-- DEEDRA 시세창 -->
          <div class="price-ticker-card">
            <div class="price-ticker-coin">💎</div>
            <div class="price-ticker-info">
              <div class="price-ticker-name">DEEDRA 현재 시세</div>
              <div class="price-ticker-value" id="deedraPrice">$0.50</div>
              <div class="price-ticker-sub" id="deedraUpdated">최근 업데이트: -</div>
            </div>
            <div class="price-ticker-change">
              <div class="price-change-value up" id="deedraChange">-</div>
            </div>
          </div>

          <!-- D-Day 투자 현황 -->
          <div id="ddayCard" class="dday-card hidden">
            <div class="dday-header">
              <div class="dday-title">📈 진행 중인 투자</div>
              <div class="dday-badge" id="ddayBadge">D-0</div>
            </div>
            <div class="dday-name" id="ddayName">-</div>
            <div class="dday-progress-wrap">
              <div class="dday-progress-labels">
                <span id="ddayStart">-</span>
                <span id="ddayEnd">-</span>
              </div>
              <div class="dday-progress-bar">
                <div class="dday-progress-fill" id="ddayFill" style="width:0%"></div>
              </div>
            </div>
            <div class="dday-stats">
              <div class="dday-stat">
                <div class="dday-stat-label">투자금</div>
                <div class="dday-stat-value" id="ddayAmount">-</div>
              </div>
              <div class="dday-stat">
                <div class="dday-stat-label">예상 수익</div>
                <div class="dday-stat-value green" id="ddayReturn">-</div>
              </div>
              <div class="dday-stat">
                <div class="dday-stat-label">남은 기간</div>
                <div class="dday-stat-value" id="ddayRemain">-</div>
              </div>
            </div>
          </div>

          <!-- 공지사항 -->
          <div class="section-header">
            <span class="section-title">📢 공지사항</span>
            <button class="see-all-btn" onclick="showAnnouncementModal()">전체보기</button>
          </div>
          <div id="announcementList" class="announcement-list">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
          </div>

          <!-- 최근 거래 -->
          <div class="section-header">
            <span class="section-title">💳 최근 거래</span>
            <button class="see-all-btn" onclick="switchPage('more')">전체보기</button>
          </div>
          <div id="recentTxList" class="tx-list">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
          </div>

        </div>
      </div>

      <!-- ======== INVEST 페이지 ======== -->
      <div id="investPage" class="page">
        <div class="page-scroll">
          <div class="page-title">📈 투자</div>

          <!-- 투자 현황 요약 -->
          <div class="invest-summary">
            <div class="invest-sum-item">
              <div class="invest-sum-label">활성 투자</div>
              <div class="invest-sum-value" id="activeInvestCount">0건</div>
            </div>
            <div class="invest-sum-item">
              <div class="invest-sum-label">총 투자금</div>
              <div class="invest-sum-value" id="totalInvestAmount">$0</div>
            </div>
            <div class="invest-sum-item">
              <div class="invest-sum-label">예상 수익</div>
              <div class="invest-sum-value green" id="expectedReturn">$0</div>
            </div>
          </div>

          <!-- 투자 시뮬레이터 -->
          <div class="simulator-card">
            <div class="simulator-title">
              <i class="fas fa-calculator"></i> 투자 수익 시뮬레이터
            </div>
            <div class="simulator-inputs">
              <select class="sim-select" id="simProduct" onchange="runSimulator()">
                <option value="">상품 선택</option>
              </select>
              <input type="number" class="form-input" id="simAmount" placeholder="USDT 금액"
                style="flex:1" oninput="runSimulator()" />
            </div>
            <div class="simulator-result" id="simResult">
              <div class="sim-row">
                <span class="sim-label">투자 금액</span>
                <span class="sim-value" id="simInputAmount">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label">기간</span>
                <span class="sim-value" id="simDays">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label">수익률</span>
                <span class="sim-value" id="simRoi">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label">수익 (DEEDRA)</span>
                <span class="sim-value highlight" id="simEarning">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label">USD 환산 수익</span>
                <span class="sim-value green" id="simEarningUsd">-</span>
              </div>
            </div>
          </div>

          <!-- 투자 상품 목록 -->
          <div class="section-header">
            <span class="section-title">💼 투자 상품</span>
          </div>
          <div id="productList" class="product-list">
            <div class="skeleton-item tall"></div>
            <div class="skeleton-item tall"></div>
          </div>

          <!-- 내 투자 현황 -->
          <div class="section-header mt-16">
            <span class="section-title">📋 내 투자 현황</span>
          </div>
          <div id="myInvestList" class="invest-list">
            <div class="skeleton-item"></div>
          </div>

        </div>
      </div>

      <!-- ======== NETWORK 페이지 ======== -->
      <div id="networkPage" class="page">
        <div class="page-scroll">
          <div class="page-title">🌐 네트워크</div>

          <!-- 네트워크 통계 -->
          <div class="network-stats">
            <div class="net-stat">
              <div class="net-stat-label">직접 추천</div>
              <div class="net-stat-value accent" id="netDirectCount">0</div>
            </div>
            <div class="net-stat">
              <div class="net-stat-label">전체 하위</div>
              <div class="net-stat-value" id="netTotalCount">0</div>
            </div>
            <div class="net-stat">
              <div class="net-stat-label">획득 보너스</div>
              <div class="net-stat-value green" id="netBonus">$0</div>
            </div>
          </div>

          <!-- 내 추천 코드 -->
          <div class="referral-card">
            <div class="referral-label">내 추천 코드</div>
            <div class="referral-code-row">
              <div class="referral-code" id="myReferralCode">-</div>
              <button class="copy-btn" onclick="copyReferralCode()">
                <i class="fas fa-copy"></i> 복사
              </button>
            </div>
            <button class="share-btn" onclick="shareReferralLink()">
              <i class="fas fa-share-alt"></i> 추천 링크 공유
            </button>
          </div>

          <!-- 직급 현황 -->
          <div class="rank-card">
            <div class="rank-title">현재 직급</div>
            <div class="rank-current" id="rankCurrent">G0</div>
            <div class="rank-progress-label">다음 직급: <span id="rankNextLabel">G1 (3명 필요)</span></div>
            <div class="rank-progress-bar">
              <div class="rank-progress-fill" id="rankProgressFill" style="width:0%"></div>
            </div>
            <div class="rank-referral-count">직접 추천: <strong id="rankReferralCount">0</strong>명</div>
          </div>

          <!-- 조직도 -->
          <div class="section-header">
            <span class="section-title">🗂 조직도</span>
            <button class="see-all-btn" onclick="resetOrgZoom()">초기화</button>
          </div>
          <div class="org-chart-wrap" id="orgChartWrap">
            <div class="org-tree" id="orgTree">
              <div class="empty-state">
                <i class="fas fa-sitemap"></i>
                조직도를 불러오는 중...
              </div>
            </div>
          </div>

          <!-- 직접 추천인 목록 -->
          <div class="section-header mt-16">
            <span class="section-title">👥 직접 추천인</span>
          </div>
          <div id="referralList" class="referral-list">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
          </div>

        </div>
      </div>

      <!-- ======== PLAY 페이지 ======== -->
      <div id="playPage" class="page">
        <div class="page-scroll">
          <div class="page-title">🎮 Play</div>

          <!-- 게임 지갑 -->
          <div class="game-wallet-bar">
            <div>
              <div class="game-wallet-label">게임 지갑 잔액</div>
              <div class="game-wallet-value"><span id="gameBalance">0.00</span> DEEDRA</div>
              <div class="game-wallet-sub" id="gameBalanceUsd">≈ $0.00</div>
            </div>
            <button class="btn btn-accent" onclick="chargeGameWallet()" style="padding:10px 16px;font-size:13px">
              <i class="fas fa-plus"></i> 충전
            </button>
          </div>

          <!-- 게임 로비 -->
          <div class="section-header">
            <span class="section-title">🎰 게임 선택</span>
          </div>
          <div class="game-grid">
            <div class="game-card" onclick="startGame('oddeven')">
              <div class="game-badge badge-live">LIVE</div>
              <div class="game-thumb oddeven">🎲</div>
              <div class="game-name">홀짝</div>
              <div class="game-desc">50% 확률, 2배 수익</div>
            </div>
            <div class="game-card" onclick="startGame('dice')">
              <div class="game-badge badge-hot">HOT</div>
              <div class="game-thumb dice">🎯</div>
              <div class="game-name">주사위</div>
              <div class="game-desc">숫자 맞추기 6배</div>
            </div>
            <div class="game-card" onclick="startGame('slot')">
              <div class="game-thumb slot">🎰</div>
              <div class="game-name">슬롯머신</div>
              <div class="game-desc">잭팟 최대 50배</div>
            </div>
            <div class="game-card coming-soon">
              <div class="game-badge badge-soon">준비중</div>
              <div class="game-thumb baccarat">🃏</div>
              <div class="game-name">바카라</div>
              <div class="game-desc">라이브 카지노</div>
            </div>
            <div class="game-card coming-soon">
              <div class="game-badge badge-soon">준비중</div>
              <div class="game-thumb roulette">🎡</div>
              <div class="game-name">룰렛</div>
              <div class="game-desc">클래식 룰렛</div>
            </div>
            <div class="game-card coming-soon">
              <div class="game-badge badge-soon">준비중</div>
              <div class="game-thumb poker">🂡</div>
              <div class="game-name">포커</div>
              <div class="game-desc">텍사스 홀덤</div>
            </div>
          </div>

          <!-- 홀짝 게임 -->
          <div id="gameOddEven" class="game-area hidden">
            <div class="game-area-header">
              <span class="game-area-title">🎲 홀짝 게임</span>
              <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="game-body">
              <div class="bet-info-row">
                <span class="bet-info-label">베팅 금액</span>
                <span class="bet-info-value"><span id="oeCurrentBet">10</span> DEEDRA</span>
              </div>
              <div class="bet-slider-wrap">
                <div class="bet-slider-label">
                  <span>1 DEEDRA</span><span>최대 잔액</span>
                </div>
                <input type="range" class="bet-slider" id="oeBetSlider" min="1" max="1000" value="10"
                  oninput="updateBetDisplay('oe', this.value)" />
              </div>
              <div class="bet-quick-row">
                <button class="bet-quick-btn" onclick="setBetAmount('oe', 10)">10</button>
                <button class="bet-quick-btn" onclick="setBetAmount('oe', 50)">50</button>
                <button class="bet-quick-btn" onclick="setBetAmount('oe', 100)">100</button>
                <button class="bet-quick-btn" onclick="setBetGameHalf('oe')">1/2</button>
              </div>
              <div class="choice-row">
                <button class="choice-btn odd" id="oeBtnOdd" onclick="playOddEven('odd')">
                  <i class="fas fa-circle"></i> 홀 (Odd)
                </button>
                <button class="choice-btn even" id="oeBtnEven" onclick="playOddEven('even')">
                  <i class="far fa-circle"></i> 짝 (Even)
                </button>
              </div>
              <div id="oeResult" class="game-result hidden"></div>
            </div>
          </div>

          <!-- 주사위 게임 -->
          <div id="gameDice" class="game-area hidden">
            <div class="game-area-header">
              <span class="game-area-title">🎯 주사위 게임</span>
              <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="game-body">
              <div class="bet-info-row">
                <span class="bet-info-label">베팅 금액</span>
                <span class="bet-info-value"><span id="diceCurrentBet">10</span> DEEDRA</span>
              </div>
              <div class="bet-quick-row">
                <button class="bet-quick-btn" onclick="setBetAmount('dice', 10)">10</button>
                <button class="bet-quick-btn" onclick="setBetAmount('dice', 50)">50</button>
                <button class="bet-quick-btn" onclick="setBetAmount('dice', 100)">100</button>
                <button class="bet-quick-btn" onclick="setBetGameHalf('dice')">1/2</button>
              </div>
              <div class="dice-display" id="diceDisplay">🎲</div>
              <div class="dice-number-row">
                ${[1,2,3,4,5,6].map(n => `<button class="dice-num-btn" onclick="playDice(${n})">${n}</button>`).join('')}
              </div>
              <div id="diceResult" class="game-result hidden"></div>
            </div>
          </div>

          <!-- 슬롯 게임 -->
          <div id="gameSlot" class="game-area hidden">
            <div class="game-area-header">
              <span class="game-area-title">🎰 슬롯머신</span>
              <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="game-body">
              <div class="bet-info-row">
                <span class="bet-info-label">베팅 금액</span>
                <span class="bet-info-value"><span id="slotCurrentBet">10</span> DEEDRA</span>
              </div>
              <div class="bet-quick-row">
                <button class="bet-quick-btn" onclick="setBetAmount('slot', 10)">10</button>
                <button class="bet-quick-btn" onclick="setBetAmount('slot', 50)">50</button>
                <button class="bet-quick-btn" onclick="setBetAmount('slot', 100)">100</button>
                <button class="bet-quick-btn" onclick="setBetGameHalf('slot')">1/2</button>
              </div>
              <div class="slot-machine">
                <div class="slot-reel" id="reel1">🍋</div>
                <div class="slot-reel" id="reel2">🍋</div>
                <div class="slot-reel" id="reel3">🍋</div>
              </div>
              <button class="btn btn-primary btn-full mt-12" onclick="playSpin()" id="spinBtn">
                <i class="fas fa-play"></i> 스핀!
              </button>
              <div id="slotResult" class="game-result hidden"></div>
            </div>
          </div>

          <!-- 게임 기록 -->
          <div class="section-header mt-16">
            <span class="section-title">📋 최근 게임 기록</span>
          </div>
          <div id="gameLogList" class="tx-list">
            <div class="empty-state">
              <i class="fas fa-gamepad"></i>
              게임을 시작해보세요!
            </div>
          </div>

        </div>
      </div>

      <!-- ======== MORE 페이지 ======== -->
      <div id="morePage" class="page">
        <div class="page-scroll">

          <!-- 프로필 카드 -->
          <div class="profile-card">
            <div class="profile-avatar">👤</div>
            <div class="profile-info">
              <div class="profile-name" id="profileName">-</div>
              <div class="profile-email" id="profileEmail">-</div>
              <div class="profile-rank-badge" id="profileRank">
                <i class="fas fa-star" style="font-size:10px"></i> G0
              </div>
            </div>
          </div>

          <!-- 지갑 섹션 -->
          <div class="menu-section">
            <div class="menu-section-title">💰 지갑</div>
            <div class="wallet-balance-card">
              <div class="wb-item">
                <div class="wb-icon usdt-icon">₮</div>
                <div class="wb-info">
                  <div class="wb-label">USDT 잔액</div>
                  <div class="wb-value" id="moreWalletUsdt">0.00</div>
                </div>
              </div>
              <div class="wb-item">
                <div class="wb-icon dedra-icon">💎</div>
                <div class="wb-info">
                  <div class="wb-label">DEEDRA 잔액</div>
                  <div class="wb-value" id="moreWalletDedra">0.00</div>
                  <div class="wb-sub" id="moreWalletDedraUsd">≈ $0.00</div>
                </div>
              </div>
              <div class="wb-item">
                <div class="wb-icon bonus-icon">🎁</div>
                <div class="wb-info">
                  <div class="wb-label">보너스 잔액</div>
                  <div class="wb-value" id="moreWalletBonus">0.00</div>
                </div>
              </div>
            </div>
            <div class="wallet-action-row">
              <button class="wallet-action-btn deposit" onclick="showDepositModal()">
                <i class="fas fa-arrow-down"></i>
                <span>USDT 입금</span>
              </button>
              <button class="wallet-action-btn withdraw" onclick="showWithdrawModal()">
                <i class="fas fa-arrow-up"></i>
                <span>DEEDRA 출금</span>
              </button>
            </div>
          </div>

          <!-- 거래 내역 -->
          <div class="menu-section">
            <div class="menu-section-title">📊 거래 내역</div>
            <div class="tx-tabs">
              <button class="tx-tab active" onclick="switchTxTab('all', this)">전체</button>
              <button class="tx-tab" onclick="switchTxTab('deposit', this)">입금</button>
              <button class="tx-tab" onclick="switchTxTab('withdrawal', this)">출금</button>
              <button class="tx-tab" onclick="switchTxTab('invest', this)">투자</button>
            </div>
            <div id="txHistoryList" class="tx-list">
              <div class="skeleton-item"></div>
              <div class="skeleton-item"></div>
            </div>
          </div>

          <!-- 공지사항 -->
          <div class="menu-section">
            <div class="menu-section-title">📢 공지사항</div>
            <div id="moreAnnouncementList" class="announcement-list">
              <div class="skeleton-item"></div>
            </div>
          </div>

          <!-- 계정 관리 -->
          <div class="menu-section">
            <div class="menu-section-title">⚙️ 계정 관리</div>
            <div class="menu-list">
              <div class="menu-item" onclick="showProfileEdit()">
                <div class="menu-item-icon icon-blue"><i class="fas fa-user-edit"></i></div>
                <span class="menu-item-text">프로필 수정</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
              <div class="menu-item" onclick="showPasswordChange()">
                <div class="menu-item-icon icon-gray"><i class="fas fa-lock"></i></div>
                <span class="menu-item-text">비밀번호 변경</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
              <div class="menu-item" onclick="showWithdrawPinSetup()">
                <div class="menu-item-icon icon-gold"><i class="fas fa-key"></i></div>
                <span class="menu-item-text">출금 PIN 설정</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
              <div class="menu-item" onclick="showTickets()">
                <div class="menu-item-icon icon-green"><i class="fas fa-headset"></i></div>
                <span class="menu-item-text">1:1 문의</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
            </div>
          </div>

          <!-- 설정 -->
          <div class="menu-section">
            <div class="menu-section-title">🔧 설정</div>
            <div class="menu-list">
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-moon"></i></div>
                <span class="menu-item-text">다크 모드</span>
                <button class="menu-item-toggle" id="darkModeToggle" onclick="toggleThemeFromMenu()" ></button>
              </div>
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-globe"></i></div>
                <span class="menu-item-text">언어</span>
                <select class="lang-select" onchange="changeLang(this.value)">
                  <option value="ko" selected>한국어</option>
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                </select>
              </div>
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-bell"></i></div>
                <span class="menu-item-text">알림</span>
                <button class="menu-item-toggle on" id="notiToggle" onclick="toggleNoti(this)"></button>
              </div>
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-info-circle"></i></div>
                <span class="menu-item-text">앱 버전</span>
                <span class="menu-item-value">v2.0.0</span>
              </div>
            </div>
          </div>

          <!-- 로그아웃 -->
          <div class="menu-section">
            <div class="menu-list">
              <div class="menu-item danger" onclick="handleLogout()">
                <div class="menu-item-icon"><i class="fas fa-sign-out-alt"></i></div>
                <span class="menu-item-text">로그아웃</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
            </div>
          </div>

          <div style="height:20px"></div>
        </div>
      </div>

    </div><!-- /page-container -->

    <!-- 하단 탭 네비게이션 -->
    <nav class="bottom-nav">
      <button class="nav-item active" id="nav-home" onclick="switchPage('home')">
        <i class="fas fa-home"></i>
        <span>Home</span>
      </button>
      <button class="nav-item" id="nav-invest" onclick="switchPage('invest')">
        <i class="fas fa-chart-line"></i>
        <span>Invest</span>
      </button>
      <button class="nav-item" id="nav-network" onclick="switchPage('network')">
        <i class="fas fa-sitemap"></i>
        <span>Network</span>
      </button>
      <button class="nav-item" id="nav-play" onclick="switchPage('play')">
        <i class="fas fa-gamepad"></i>
        <span>Play</span>
      </button>
      <button class="nav-item" id="nav-more" onclick="switchPage('more')">
        <i class="fas fa-ellipsis-h"></i>
        <span>More</span>
      </button>
    </nav>

  </div><!-- /mainApp -->

</div><!-- /app -->

<!-- ===== 모달들 ===== -->

<!-- USDT 입금 모달 -->
<div id="depositModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('depositModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">💰 USDT 입금 신청</div>
    <div class="modal-body">
      <div class="info-box">
        <div class="info-label">회사 입금 주소 (TRC20)</div>
        <div class="wallet-address-box">
          <span id="companyWalletAddr">주소 로딩중...</span>
          <button onclick="copyWalletAddress()" class="copy-btn" style="padding:8px 12px;font-size:12px">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">입금 금액 (USDT)</label>
        <input type="number" id="depositAmount" class="form-input" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label class="form-label">TXID (트랜잭션 해시)</label>
        <input type="text" id="depositTxid" class="form-input" placeholder="트랜잭션 해시 입력" />
      </div>
      <div class="form-group">
        <label class="form-label">메모 (선택)</label>
        <input type="text" id="depositMemo" class="form-input" placeholder="메모 입력 (선택)" />
      </div>
      <div class="warning-box">⚠️ 반드시 위 주소로 입금 후 TXID를 입력해주세요. 관리자 승인 후 잔액이 업데이트됩니다.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('depositModal')" style="flex:1">취소</button>
      <button class="btn btn-primary" onclick="submitDeposit()" style="flex:2">입금 신청</button>
    </div>
  </div>
</div>

<!-- DEEDRA 출금 모달 -->
<div id="withdrawModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('withdrawModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">💸 DEEDRA 출금 신청</div>
    <div class="modal-body">
      <div class="info-box">
        <div class="info-label">출금 가능 잔액</div>
        <div style="font-size:22px;font-weight:800;color:var(--accent)">
          <span id="withdrawAvailable">0.00</span> DEEDRA
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">출금 금액 (DEEDRA)</label>
        <input type="number" id="withdrawAmount" class="form-input" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label class="form-label">수신 지갑 주소</label>
        <input type="text" id="withdrawAddress" class="form-input" placeholder="수신 지갑 주소 입력" />
      </div>
      <div class="form-group">
        <label class="form-label">출금 PIN (6자리)</label>
        <input type="password" id="withdrawPin" class="form-input" placeholder="●●●●●●" maxlength="6" />
      </div>
      <div class="warning-box">⚠️ 출금 신청 후 관리자 승인까지 1~3 영업일 소요됩니다.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('withdrawModal')" style="flex:1">취소</button>
      <button class="btn btn-primary" onclick="submitWithdraw()" style="flex:2">출금 신청</button>
    </div>
  </div>
</div>

<!-- 투자 신청 모달 -->
<div id="investModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('investModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">📈 투자 신청</div>
    <div class="modal-body">
      <div class="invest-product-summary" id="investProductSummary"></div>
      <div class="form-group">
        <label class="form-label">투자 금액 (USDT)</label>
        <input type="number" id="investAmount" class="form-input" placeholder="0.00" oninput="updateInvestPreview()" />
        <div class="input-hint" id="investAmountHint"></div>
      </div>
      <div class="invest-preview" id="investPreview" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('investModal')" style="flex:1">취소</button>
      <button class="btn btn-primary" onclick="submitInvest()" style="flex:2">투자 신청</button>
    </div>
  </div>
</div>

<!-- 게임 충전 모달 -->
<div id="chargeModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('chargeModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">🎮 게임 지갑 충전</div>
    <div class="modal-body">
      <div class="info-box">
        <div class="info-label">DEEDRA 잔액에서 게임 지갑으로 이동</div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">
          보유: <span id="chargeAvailable">0.00</span> DEEDRA
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">충전 금액 (DEEDRA)</label>
        <input type="number" id="chargeAmount" class="form-input" placeholder="0.00" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('chargeModal')" style="flex:1">취소</button>
      <button class="btn btn-primary" onclick="submitCharge()" style="flex:2">충전</button>
    </div>
  </div>
</div>

<!-- 출금 PIN 모달 -->
<div id="pinModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('pinModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">🔐 출금 PIN 설정</div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">새 PIN (6자리)</label>
        <input type="password" id="newPin" class="form-input" placeholder="●●●●●●" maxlength="6" />
      </div>
      <div class="form-group">
        <label class="form-label">PIN 확인</label>
        <input type="password" id="confirmPin" class="form-input" placeholder="●●●●●●" maxlength="6" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('pinModal')" style="flex:1">취소</button>
      <button class="btn btn-primary" onclick="saveWithdrawPin()" style="flex:2">저장</button>
    </div>
  </div>
</div>

<!-- 프로필 수정 모달 -->
<div id="profileModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('profileModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">✏️ 프로필 수정</div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">이름</label>
        <input type="text" id="editName" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">연락처</label>
        <input type="text" id="editPhone" class="form-input" placeholder="010-0000-0000" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('profileModal')" style="flex:1">취소</button>
      <button class="btn btn-primary" onclick="saveProfile()" style="flex:2">저장</button>
    </div>
  </div>
</div>

<!-- 1:1 문의 모달 -->
<div id="ticketModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('ticketModal')"></div>
  <div class="modal-sheet large">
    <div class="modal-handle"></div>
    <div class="modal-title">💬 1:1 문의</div>
    <div class="modal-body">
      <div id="ticketList" class="ticket-list"></div>
      <div class="divider"></div>
      <div class="form-group">
        <label class="form-label">제목</label>
        <input type="text" id="ticketTitle" class="form-input" placeholder="문의 제목" />
      </div>
      <div class="form-group">
        <label class="form-label">내용</label>
        <textarea id="ticketContent" class="form-input textarea" placeholder="문의 내용을 입력하세요"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('ticketModal')" style="flex:1">닫기</button>
      <button class="btn btn-primary" onclick="submitTicket()" style="flex:2">문의 등록</button>
    </div>
  </div>
</div>

<!-- 공지사항 모달 -->
<div id="announcementModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('announcementModal')"></div>
  <div class="modal-sheet large">
    <div class="modal-handle"></div>
    <div class="modal-title">📢 공지사항</div>
    <div class="modal-body">
      <div id="announcementFullList"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost btn-full" onclick="closeModal('announcementModal')">닫기</button>
    </div>
  </div>
</div>

<!-- 툴팁 -->
<div id="orgTooltip" class="hidden" style="
  position:fixed;z-index:500;
  background:var(--bg2);border:1px solid var(--border);
  border-radius:var(--radius);padding:12px 14px;
  font-size:13px;box-shadow:var(--shadow);
  max-width:200px;pointer-events:none;
"></div>

<!-- Toast -->
<div id="toast" class="toast"></div>

<!-- Firebase SDK -->
<script type="module" src="/static/firebase.js"></script>
<script src="/static/app.js"></script>
</body>
</html>`

app.get('/', (c) => c.html(HTML()))
app.get('/app', (c) => c.html(HTML()))

// ─── Setup Page ───────────────────────────────────────────────────────────────
const SETUP_HTML = () => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>DEEDRA 테스트 계정 생성</title>
  <style>
    body { font-family: sans-serif; padding: 40px; background: #f3f4f6; }
    .card { background: white; padding: 32px; border-radius: 12px; max-width: 520px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h2 { margin-bottom: 24px; color: #0d47a1; }
    .log { background: #1f2937; color: #10b981; padding: 16px; border-radius: 8px; font-size: 13px; font-family: monospace; min-height: 200px; white-space: pre-wrap; margin-top: 16px; overflow-y: auto; max-height: 400px; }
    button { padding: 12px 24px; background: #0d47a1; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 16px; width: 100%; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
<div class="card">
  <h2>🛠️ DEEDRA 테스트 계정 생성</h2>
  <p style="color:#6b7280;margin-bottom:8px">버튼을 클릭하면 Firebase에 테스트 계정 3개가 생성됩니다.</p>
  <button id="createBtn" onclick="createTestAccounts()">▶ 테스트 계정 3개 생성 시작</button>
  <div class="log" id="log">버튼을 클릭하면 테스트 계정이 생성됩니다...</div>
</div>
<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const app = initializeApp({
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
});
const auth = getAuth(app);
const db = getFirestore(app);

const testAccounts = [
  { email:'test1@deedra.com', password:'Test1234!', name:'테스트1호', rank:'G1', usdt:1000, dedra:500, bonus:50, referralCode:'TEST0001' },
  { email:'test2@deedra.com', password:'Test1234!', name:'테스트2호', rank:'G0', usdt:500,  dedra:200, bonus:20, referralCode:'TEST0002' },
  { email:'test3@deedra.com', password:'Test1234!', name:'테스트3호', rank:'G2', usdt:5000, dedra:2000,bonus:300,referralCode:'TEST0003' },
];

function log(msg, color='#d1d5db') {
  const el = document.getElementById('log');
  el.innerHTML += '<span style="color:'+color+'">'+msg+'</span>\\n';
  el.scrollTop = el.scrollHeight;
}

window.createTestAccounts = async function() {
  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  document.getElementById('log').innerHTML = '';

  for (const a of testAccounts) {
    log('\\n📋 ['+a.email+'] 처리 중...', '#60a5fa');
    try {
      let uid;
      try {
        const c = await createUserWithEmailAndPassword(auth, a.email, a.password);
        uid = c.user.uid;
        log('  ✅ Auth 계정 신규 생성', '#10b981');
      } catch(e) {
        if(e.code==='auth/email-already-in-use') {
          const c = await signInWithEmailAndPassword(auth, a.email, a.password);
          uid = c.user.uid;
          log('  ℹ️ 기존 계정 업데이트', '#60a5fa');
        } else throw e;
      }
      await setDoc(doc(db,'users',uid), { uid, email:a.email, name:a.name, role:'member', rank:a.rank, status:'active', referralCode:a.referralCode, referredBy:null, phone:'', withdrawPin:btoa('123456'), createdAt:serverTimestamp() }, {merge:true});
      await setDoc(doc(db,'wallets',uid), { userId:uid, usdtBalance:a.usdt, dedraBalance:a.dedra, bonusBalance:a.bonus, totalDeposit:a.usdt, totalWithdrawal:0, totalEarnings:a.bonus, createdAt:serverTimestamp() }, {merge:true});
      log('  ✅ Firestore 저장 완료 (USDT:'+a.usdt+' / DEEDRA:'+a.dedra+')', '#10b981');
    } catch(e) {
      log('  ❌ 오류: '+e.message, '#ef4444');
    }
  }

  log('\\n========================================', '#6b7280');
  log('🎉 완료! 아래 계정으로 앱에서 로그인하세요', '#f59e0b');
  log('========================================', '#6b7280');
  testAccounts.forEach(a => {
    log('📧 '+a.email+'  🔑 '+a.password, '#10b981');
    log('   직급:'+a.rank+' | USDT:'+a.usdt+' | DEEDRA:'+a.dedra+' | 출금PIN:123456', '#60a5fa');
    log('----------------------------------------', '#374151');
  });
  btn.disabled = false;
};
</script>
</body>
</html>`

export default app
