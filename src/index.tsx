import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Static files
app.use('/static/*', serveStatic({ root: './' }))

// 테스트 계정 생성 페이지
app.get('/setup', (c) => c.html(SETUP_HTML()))

// 관리자 페이지
app.get('/admin', (c) => c.redirect('/static/admin.html'))
app.get('/admin.html', (c) => c.redirect('/static/admin.html'))

// ─── Main App (SPA) ───────────────────────────────────────────────────────────
const HTML = () => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>DEEDRA</title>
  <link rel="icon" href="/static/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Sans+Thai:wght@400;500;700;900&display=swap" rel="stylesheet">
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
        <p class="auth-tagline" data-i18n="authTagline">🔐 안전하고 스마트한 가상자산 투자</p>
        <div class="auth-tabs">
          <button class="auth-tab active" id="loginTab" onclick="switchAuthTab('login')" data-i18n="loginTab">로그인</button>
          <button class="auth-tab" id="registerTab" onclick="switchAuthTab('register')" data-i18n="registerTab">회원가입</button>
        </div>

        <!-- 로그인 폼 -->
        <div id="loginForm">
          <div class="form-group">
            <label class="form-label" data-i18n="labelEmail">이메일</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="이메일을 입력하세요" data-i18n="placeholderEmail" data-i18n-attr="placeholder" />
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="labelPassword">비밀번호</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="비밀번호를 입력하세요" data-i18n="placeholderPassword" data-i18n-attr="placeholder" />
          </div>
          <button class="btn btn-primary btn-full mt-8" onclick="handleLogin()">
            <i class="fas fa-sign-in-alt"></i> <span data-i18n="btnLogin">로그인</span>
          </button>
          <button class="btn btn-ghost btn-full mt-8" onclick="handleForgotPassword()" style="font-size:14px" data-i18n="forgotPassword">
            비밀번호를 잊으셨나요?
          </button>
        </div>

        <!-- 회원가입 폼 -->
        <div id="registerForm" class="hidden">
          <div class="form-group">
            <label class="form-label" data-i18n="labelName">이름</label>
            <input type="text" id="regName" class="form-input" placeholder="이름을 입력하세요" data-i18n="placeholderName" data-i18n-attr="placeholder" />
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="labelEmail">이메일</label>
            <input type="email" id="regEmail" class="form-input" placeholder="이메일을 입력하세요" data-i18n="placeholderEmail" data-i18n-attr="placeholder" />
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="labelPassword">비밀번호</label>
            <input type="password" id="regPassword" class="form-input" placeholder="8자리 이상 입력하세요" data-i18n="placeholderPasswordMin" data-i18n-attr="placeholder" />
          </div>
          <div class="form-group">
            <label class="form-label"><span data-i18n="labelReferral">추천인 코드</span> <span class="required" data-i18n="referralRequired">* 필수</span></label>
            <input type="text" id="regReferral" class="form-input" placeholder="추천인 코드를 입력하세요" data-i18n="placeholderReferral" data-i18n-attr="placeholder" />
          </div>
          <button class="btn btn-primary btn-full mt-8" onclick="handleRegister()">
            <i class="fas fa-user-plus"></i> <span data-i18n="btnRegister">회원가입</span>
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
            <div class="asset-total-label" data-i18n="totalAssetLabel">총 자산 (USD 환산)</div>
            <div class="asset-total-amount" id="totalAsset">$0.00</div>
            <div class="asset-total-sub" id="totalAssetKrw">≈ ₩0</div>

            <!-- 원금/이자 분리 -->
            <div class="asset-split-row">
              <div class="asset-split-item">
                <div class="asset-split-icon">🔒</div>
                <div class="asset-split-label" data-i18n="assetLocked">USDT 원금 (잠금)</div>
                <div class="asset-split-value" id="splitUsdt">0.00</div>
                <div class="asset-split-sub" data-i18n="assetInvesting">투자 중</div>
              </div>
              <div class="asset-split-item">
                <div class="asset-split-icon">💎</div>
                <div class="asset-split-label" data-i18n="assetInterest">DEEDRA 이자 (출금 가능)</div>
                <div class="asset-split-value" id="splitDedra">0.00</div>
                <div class="asset-split-sub" id="splitDedraUsd">≈ $0.00</div>
              </div>
            </div>

            <!-- 입출금 버튼 -->
            <div class="asset-action-row">
              <button class="asset-action-btn deposit" onclick="showDepositModal()">
                <i class="fas fa-arrow-down"></i> <span data-i18n="btnDeposit">USDT 입금</span>
              </button>
              <button class="asset-action-btn withdraw" onclick="showWithdrawModal()">
                <i class="fas fa-arrow-up"></i> <span data-i18n="btnWithdraw">DEEDRA 출금</span>
              </button>
            </div>
          </div>

          <!-- DEEDRA 시세창 -->
          <div class="price-ticker-card">
            <div class="price-ticker-coin">💎</div>
            <div class="price-ticker-info">
              <div class="price-ticker-name" data-i18n="deedraPrice">DEEDRA 현재 시세</div>
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
              <div class="dday-title" data-i18n="investingNow">📈 진행 중인 투자</div>
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
                <div class="dday-stat-label" data-i18n="investAmount">투자금</div>
                <div class="dday-stat-value" id="ddayAmount">-</div>
              </div>
              <div class="dday-stat">
                <div class="dday-stat-label" data-i18n="expectedReturn">예상 수익</div>
                <div class="dday-stat-value green" id="ddayReturn">-</div>
              </div>
              <div class="dday-stat">
                <div class="dday-stat-label" data-i18n="remaining">남은 기간</div>
                <div class="dday-stat-value" id="ddayRemain">-</div>
              </div>
            </div>
          </div>

          <!-- 공지사항 -->
          <div class="section-header">
            <span class="section-title" data-i18n="announcements">📢 공지사항</span>
            <button class="see-all-btn" onclick="showAnnouncementModal()" data-i18n="seeAll">전체보기</button>
          </div>
          <div id="announcementList" class="announcement-list">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
          </div>

          <!-- 최근 거래 -->
          <div class="section-header">
            <span class="section-title" data-i18n="recentTx">💳 최근 거래</span>
            <button class="see-all-btn" onclick="switchPage('more')" data-i18n="seeAll">전체보기</button>
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
          <div class="page-title" data-i18n="pageInvest">📈 투자</div>

          <!-- 투자 현황 요약 -->
          <div class="invest-summary">
            <div class="invest-sum-item">
              <div class="invest-sum-label" data-i18n="activeInvest">활성 투자</div>
              <div class="invest-sum-value" id="activeInvestCount">0건</div>
            </div>
            <div class="invest-sum-item">
              <div class="invest-sum-label" data-i18n="totalInvest">총 투자금</div>
              <div class="invest-sum-value" id="totalInvestAmount">$0</div>
            </div>
            <div class="invest-sum-item">
              <div class="invest-sum-label" data-i18n="expectedReturnLabel">예상 수익</div>
              <div class="invest-sum-value green" id="expectedReturn">$0</div>
            </div>
          </div>

          <!-- 투자 시뮬레이터 -->
          <div class="simulator-card">
            <div class="simulator-title">
              <i class="fas fa-calculator"></i> <span data-i18n="simTitle">투자 수익 시뮬레이터</span>
            </div>
            <div class="simulator-inputs">
              <select class="sim-select" id="simProduct" onchange="runSimulator()">
                <option value="" data-i18n="simSelectProduct">상품 선택</option>
              </select>
              <input type="number" class="form-input" id="simAmount" placeholder="USDT 금액"
                style="flex:1" oninput="runSimulator()" />
            </div>
            <div class="simulator-result" id="simResult">
              <div class="sim-row">
                <span class="sim-label" data-i18n="simInvestAmount">투자 금액</span>
                <span class="sim-value" id="simInputAmount">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label" data-i18n="simPeriod">기간</span>
                <span class="sim-value" id="simDays">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label" data-i18n="simRoi">수익률</span>
                <span class="sim-value" id="simRoi">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label" data-i18n="simEarning">수익 (DEEDRA)</span>
                <span class="sim-value highlight" id="simEarning">-</span>
              </div>
              <div class="sim-row">
                <span class="sim-label" data-i18n="simEarningUsd">USD 환산 수익</span>
                <span class="sim-value green" id="simEarningUsd">-</span>
              </div>
            </div>
          </div>

          <!-- 투자 상품 목록 -->
          <div class="section-header">
            <span class="section-title" data-i18n="productListTitle">💼 투자 상품</span>
          </div>
          <div id="productList" class="product-list">
            <div class="skeleton-item tall"></div>
            <div class="skeleton-item tall"></div>
          </div>

          <!-- 내 투자 현황 -->
          <div class="section-header mt-16">
            <span class="section-title" data-i18n="myInvestTitle">📋 내 투자 현황</span>
          </div>
          <div id="myInvestList" class="invest-list">
            <div class="skeleton-item"></div>
          </div>

        </div>
      </div>

      <!-- ======== NETWORK 페이지 ======== -->
      <div id="networkPage" class="page">
        <div class="page-scroll">
          <div class="page-title" data-i18n="pageNetwork">🌐 네트워크</div>

          <!-- 네트워크 통계 -->
          <div class="network-stats">
            <div class="net-stat">
              <div class="net-stat-label" data-i18n="directRef">직접 추천</div>
              <div class="net-stat-value accent" id="netDirectCount">0</div>
            </div>
            <div class="net-stat">
              <div class="net-stat-label" data-i18n="totalDownline">전체 하위</div>
              <div class="net-stat-value" id="netTotalCount">0</div>
            </div>
            <div class="net-stat">
              <div class="net-stat-label" data-i18n="earnedBonus">획득 보너스</div>
              <div class="net-stat-value green" id="netBonus">$0</div>
            </div>
          </div>

          <!-- 내 추천 코드 -->
          <div class="referral-card">
            <div class="referral-label" data-i18n="myReferralCode">내 추천 코드</div>
            <div class="referral-code-row">
              <div class="referral-code" id="myReferralCode">-</div>
              <button class="copy-btn" onclick="copyReferralCode()">
                <i class="fas fa-copy"></i> <span data-i18n="btnCopy">복사</span>
              </button>
            </div>
            <button class="share-btn" onclick="shareReferralLink()">
              <i class="fas fa-share-alt"></i> <span data-i18n="btnShare">추천 링크 공유</span>
            </button>
          </div>

          <!-- 직급 현황 -->
          <div class="rank-card">
            <div class="rank-title" data-i18n="currentRank">현재 직급</div>
            <div class="rank-current" id="rankCurrent">G0</div>
            <div class="rank-progress-label">다음 직급: <span id="rankNextLabel">G1 (3명 필요)</span></div>
            <div class="rank-progress-bar">
              <div class="rank-progress-fill" id="rankProgressFill" style="width:0%"></div>
            </div>
            <div class="rank-referral-count">직접 추천: <strong id="rankReferralCount">0</strong>명</div>
          </div>

          <!-- 조직도 -->
          <div class="section-header">
            <span class="section-title" data-i18n="orgChart">🗂 조직도</span>
            <button class="see-all-btn" onclick="resetOrgZoom()" data-i18n="orgReset">초기화</button>
          </div>
          <div class="org-chart-wrap" id="orgChartWrap">
            <div class="org-tree" id="orgTree">
              <div class="empty-state">
                <i class="fas fa-sitemap"></i>
                <span data-i18n="orgLoading">조직도를 불러오는 중...</span>
              </div>
            </div>
          </div>

          <!-- 직접 추천인 목록 -->
          <div class="section-header mt-16">
            <span class="section-title" data-i18n="directRefList">👥 직접 추천인</span>
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
            <div style="display:flex;align-items:center;gap:12px">
              <div class="game-wallet-icon">🎮</div>
              <div>
                <div class="game-wallet-label" data-i18n="gameWalletLabel">게임 지갑 잔액</div>
                <div class="game-wallet-value"><span id="gameBalance">0.00</span> <span style="font-size:14px;font-weight:500;opacity:.7">DEEDRA</span></div>
                <div class="game-wallet-sub" id="gameBalanceUsd">≈ $0.00</div>
              </div>
            </div>
            <button class="btn btn-accent" onclick="chargeGameWallet()" style="padding:12px 18px;font-size:13px;font-weight:800;border-radius:12px;white-space:nowrap">
              <i class="fas fa-plus"></i> <span data-i18n="btnCharge">충전</span>
            </button>
          </div>

          <!-- 게임 로비 -->
          <div class="section-header">
            <span class="section-title" data-i18n="gameSelect">🎰 게임 선택</span>
          </div>
          <div class="game-grid">
            <div class="game-card" onclick="startGame('oddeven')">
              <div class="game-badge badge-live">LIVE</div>
              <div class="game-thumb oddeven">🎲</div>
              <div class="game-name" data-i18n="gameOddEven">홀짝</div>
              <div class="game-desc" data-i18n="gameOddEvenDesc">50% 확률, 2배 수익</div>
            </div>
            <div class="game-card" onclick="startGame('dice')">
              <div class="game-badge badge-hot">HOT</div>
              <div class="game-thumb dice">🎯</div>
              <div class="game-name" data-i18n="gameDice">주사위</div>
              <div class="game-desc" data-i18n="gameDiceDesc">숫자 맞추기 6배</div>
            </div>
            <div class="game-card" onclick="startGame('slot')">
              <div class="game-thumb slot">🎰</div>
              <div class="game-name" data-i18n="gameSlot">슬롯머신</div>
              <div class="game-desc" data-i18n="gameSlotDesc">잭팟 최대 50배</div>
            </div>
            <div class="game-card coming-soon">
              <div class="game-badge badge-soon" data-i18n="gameSoon">준비중</div>
              <div class="game-thumb baccarat">🃏</div>
              <div class="game-name" data-i18n="gameBaccarat">바카라</div>
              <div class="game-desc" data-i18n="gameBaccaratDesc">라이브 카지노</div>
            </div>
            <div class="game-card" onclick="startGame('roulette')">
              <div class="game-badge badge-new">NEW</div>
              <div class="game-thumb roulette">🎡</div>
              <div class="game-name" data-i18n="gameRoulette">룰렛</div>
              <div class="game-desc" data-i18n="gameRouletteDesc">숫자/색상 베팅</div>
            </div>
            <div class="game-card coming-soon">
              <div class="game-badge badge-soon" data-i18n="gameSoon">준비중</div>
              <div class="game-thumb poker">🂡</div>
              <div class="game-name" data-i18n="gamePoker">포커</div>
              <div class="game-desc" data-i18n="gamePokerDesc">텍사스 홀덤</div>
            </div>
          </div>

          <!-- 홀짝 게임 -->
          <div id="gameOddEven" class="game-area hidden">
            <div class="game-area-header">
              <span class="game-area-title" data-i18n="gameAreaOddEven">🪙 홀짝 게임</span>
              <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="game-body">
              <div class="bet-info-row">
                <span class="bet-info-label" data-i18n="betAmount">💰 베팅 금액</span>
                <span class="bet-info-value"><span id="oeCurrentBet">10</span> DEEDRA</span>
              </div>
              <div class="bet-slider-wrap">
                <div class="bet-slider-label">
                  <span>1 DEEDRA</span><span data-i18n="maxBalance">최대 잔액</span>
                </div>
                <input type="range" class="bet-slider" id="oeBetSlider" min="1" max="1000" value="10"
                  oninput="updateBetDisplay('oe', this.value)" />
              </div>
              <div class="bet-quick-row">
                <button class="bet-quick-btn" onclick="setBetAmount('oe', 10)">10</button>
                <button class="bet-quick-btn" onclick="setBetAmount('oe', 50)">50</button>
                <button class="bet-quick-btn" onclick="setBetAmount('oe', 100)">100</button>
                <button class="bet-quick-btn" onclick="setBetGameHalf('oe')">½</button>
              </div>
              <!-- 동전 애니메이션 영역 -->
              <div class="coin-arena">
                <div class="coin-flip-wrap">
                  <div class="coin-flip" id="coinFlip">
                    <div class="coin-face front">🪙</div>
                    <div class="coin-face back">💫</div>
                  </div>
                </div>
                <div class="coin-result-text" id="coinResultText" data-i18n="coinHint">홀 또는 짝을 선택하세요</div>
              </div>
              <div class="choice-row">
                <button class="choice-btn odd" id="oeBtnOdd" onclick="playOddEven('odd')">
                  <span class="choice-icon">1</span>
                  <span class="choice-label" data-i18n="choiceOdd">홀 (Odd)</span>
                  <span class="choice-odds">× 2배</span>
                </button>
                <button class="choice-btn even" id="oeBtnEven" onclick="playOddEven('even')">
                  <span class="choice-icon">2</span>
                  <span class="choice-label" data-i18n="choiceEven">짝 (Even)</span>
                  <span class="choice-odds">× 2배</span>
                </button>
              </div>
              <div id="oeResult" class="game-result hidden"></div>
            </div>
          </div>

          <!-- 주사위 게임 -->
          <div id="gameDice" class="game-area hidden">
            <div class="game-area-header">
              <span class="game-area-title" data-i18n="gameAreaDice">🎲 주사위 게임</span>
              <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="game-body">
              <div class="bet-info-row">
                <span class="bet-info-label" data-i18n="betAmount">💰 베팅 금액</span>
                <span class="bet-info-value"><span id="diceCurrentBet">10</span> DEEDRA</span>
              </div>
              <div class="bet-quick-row">
                <button class="bet-quick-btn" onclick="setBetAmount('dice', 10)">10</button>
                <button class="bet-quick-btn" onclick="setBetAmount('dice', 50)">50</button>
                <button class="bet-quick-btn" onclick="setBetAmount('dice', 100)">100</button>
                <button class="bet-quick-btn" onclick="setBetGameHalf('dice')">½</button>
              </div>
              <!-- 3D 주사위 -->
              <div class="dice-arena">
                <div class="dice-3d-wrap">
                  <div class="dice-3d" id="dice3d">
                    <div class="dice-face-svg" id="diceFaceDisplay">
                      <div class="dice-dots" id="diceDots">
                        <!-- JS로 동적 생성 -->
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="dice-number-row">
                ${[1,2,3,4,5,6].map(n => `<button class="dice-num-btn" onclick="playDice(${n})">${n}</button>`).join('')}
              </div>
              <div id="diceResult" class="game-result hidden"></div>
            </div>
          </div>

          <!-- 슬롯 게임 -->
          <div id="gameSlot" class="game-area hidden">
            <div class="game-area-header">
              <span class="game-area-title" data-i18n="gameAreaSlot">🎰 슬롯머신</span>
              <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="game-body">
              <div class="bet-info-row">
                <span class="bet-info-label" data-i18n="betAmount">💰 베팅 금액</span>
                <span class="bet-info-value"><span id="slotCurrentBet">10</span> DEEDRA</span>
              </div>
              <div class="bet-quick-row">
                <button class="bet-quick-btn" onclick="setBetAmount('slot', 10)">10</button>
                <button class="bet-quick-btn" onclick="setBetAmount('slot', 50)">50</button>
                <button class="bet-quick-btn" onclick="setBetAmount('slot', 100)">100</button>
                <button class="bet-quick-btn" onclick="setBetGameHalf('slot')">½</button>
              </div>
              <!-- 슬롯 캐비넷 -->
              <div class="slot-cabinet">
                <div class="slot-title">✦ DEEDRA SLOTS ✦</div>
                <div class="slot-machine">
                  <div class="slot-reel" id="reel1">🍋</div>
                  <div class="slot-reel" id="reel2">🍋</div>
                  <div class="slot-reel" id="reel3">🍋</div>
                </div>
                <!-- 페이테이블 -->
                <div class="pay-table">
                  <div class="pay-item">💎💎💎 = <span>×50</span></div>
                  <div class="pay-item">7️⃣7️⃣7️⃣ = <span>×20</span></div>
                  <div class="pay-item">⭐⭐⭐ = <span>×10</span></div>
                  <div class="pay-item">3같은것 = <span>×5</span></div>
                </div>
              </div>
              <button class="btn-spin" onclick="playSpin()" id="spinBtn">
                <span class="spin-icon">🎰</span> SPIN!
              </button>
              <div id="slotResult" class="game-result hidden"></div>
            </div>
          </div>

          <!-- ======== 룰렛 게임 ======== -->
          <div id="gameRoulette" class="game-area hidden">
            <div class="game-area-header">
              <span class="game-area-title" data-i18n="gameAreaRoulette">🎡 룰렛</span>
              <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="game-body roulette-body">

              <!-- 베팅 금액 + 빠른 버튼 -->
              <div class="bet-info-row">
                <span class="bet-info-label" data-i18n="betAmount">💰 베팅 금액</span>
                <span class="bet-info-value"><span id="rlCurrentBet">10</span> DEEDRA</span>
              </div>
              <div class="bet-quick-row">
                <button class="bet-quick-btn" onclick="setBetAmount('rl', 10)">10</button>
                <button class="bet-quick-btn" onclick="setBetAmount('rl', 50)">50</button>
                <button class="bet-quick-btn" onclick="setBetAmount('rl', 100)">100</button>
                <button class="bet-quick-btn" onclick="setBetGameHalf('rl')">½</button>
              </div>

              <!-- 룰렛 바퀴 Canvas -->
              <div class="roulette-wheel-wrap">
                <div class="roulette-outer-ring">
                  <div class="roulette-inner-shadow">
                    <canvas id="rouletteCanvas" width="300" height="300"></canvas>
                  </div>
                </div>
                <!-- 상단 포인터 -->
                <div class="roulette-pointer">▼</div>
              </div>

              <!-- 베팅 선택 탭 -->
              <div class="rl-bet-tabs">
                <button class="rl-tab active" onclick="switchRlTab('simple')" id="rlTabSimple" data-i18n="rlSimpleBet">간단 베팅</button>
                <button class="rl-tab" onclick="switchRlTab('number')" id="rlTabNumber" data-i18n="rlNumberBet">숫자 베팅</button>
              </div>

              <!-- 간단 베팅 판 -->
              <div id="rlPanelSimple" class="rl-bet-panel">
                <div class="rl-simple-grid">
                  <button class="rl-simple-btn red"   onclick="selectRlBet('red')"   id="rlBtnRed" data-i18n="rlRed">🔴 레드 ×2</button>
                  <button class="rl-simple-btn black" onclick="selectRlBet('black')" id="rlBtnBlack" data-i18n="rlBlack">⚫ 블랙 ×2</button>
                  <button class="rl-simple-btn green" onclick="selectRlBet('zero')"  id="rlBtnZero" data-i18n="rlZero">🟢 제로 ×35</button>
                  <button class="rl-simple-btn blue"  onclick="selectRlBet('odd')"   id="rlBtnOdd" data-i18n="rlOdd">홀수 ×2</button>
                  <button class="rl-simple-btn blue"  onclick="selectRlBet('even')"  id="rlBtnEven" data-i18n="rlEven">짝수 ×2</button>
                  <button class="rl-simple-btn orange" onclick="selectRlBet('low')"  id="rlBtnLow" data-i18n="rlLow">1-18 ×2</button>
                  <button class="rl-simple-btn orange" onclick="selectRlBet('high')" id="rlBtnHigh" data-i18n="rlHigh">19-36 ×2</button>
                  <button class="rl-simple-btn purple" onclick="selectRlBet('dozen1')" id="rlBtnDoz1" data-i18n="rlDoz1">1-12 ×3</button>
                  <button class="rl-simple-btn purple" onclick="selectRlBet('dozen2')" id="rlBtnDoz2" data-i18n="rlDoz2">13-24 ×3</button>
                  <button class="rl-simple-btn purple" onclick="selectRlBet('dozen3')" id="rlBtnDoz3" data-i18n="rlDoz3">25-36 ×3</button>
                </div>
              </div>

              <!-- 숫자 베팅 판 (0~36) -->
              <div id="rlPanelNumber" class="rl-bet-panel hidden">
                <div class="rl-number-board">
                  <button class="rl-num zero" onclick="selectRlBet('num0')" id="rlNum0">0</button>
                  <div class="rl-num-grid">
                    ${Array.from({length:36},(_,i)=>{
                      const n=i+1;
                      const reds=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                      const cls=reds.includes(n)?'red':'black';
                      return `<button class="rl-num ${cls}" onclick="selectRlBet('num${n}')" id="rlNum${n}">${n}</button>`;
                    }).join('')}
                  </div>
                </div>
              </div>

              <!-- 현재 선택 베팅 표시 -->
              <div class="rl-selected-bet" id="rlSelectedBet">
                <span class="rl-sel-label" data-i18n="rlSelectedBet">선택한 베팅:</span>
                <span class="rl-sel-value" id="rlSelValue" data-i18n="rlNone">없음</span>
              </div>

              <!-- 스핀 버튼 -->
              <button class="btn-roulette-spin" onclick="playRoulette()" id="rlSpinBtn">
                <span id="rlSpinBtnIcon">🎡</span> <span data-i18n="rlSpin">스핀!</span>
              </button>

              <div id="rouletteResult" class="game-result hidden"></div>
            </div>
          </div>
          <div class="section-header mt-16">
            <span class="section-title" data-i18n="recentGameLog">📋 최근 게임 기록</span>
          </div>
          <div id="gameLogList" class="tx-list">
            <div class="empty-state">
              <i class="fas fa-gamepad"></i>
              <span data-i18n="gameStart">게임을 시작해보세요!</span>
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
            <div class="menu-section-title" data-i18n="walletSection">💰 지갑</div>
            <div class="wallet-balance-card">
              <div class="wb-item">
                <div class="wb-icon usdt-icon">₮</div>
                <div class="wb-info">
                  <div class="wb-label" data-i18n="usdtBalance">USDT 잔액</div>
                  <div class="wb-value" id="moreWalletUsdt">0.00</div>
                </div>
              </div>
              <div class="wb-item">
                <div class="wb-icon dedra-icon">💎</div>
                <div class="wb-info">
                  <div class="wb-label" data-i18n="deedraBalance">DEEDRA 잔액</div>
                  <div class="wb-value" id="moreWalletDedra">0.00</div>
                  <div class="wb-sub" id="moreWalletDedraUsd">≈ $0.00</div>
                </div>
              </div>
              <div class="wb-item">
                <div class="wb-icon bonus-icon">🎁</div>
                <div class="wb-info">
                  <div class="wb-label" data-i18n="bonusBalance">보너스 잔액</div>
                  <div class="wb-value" id="moreWalletBonus">0.00</div>
                </div>
              </div>
            </div>
            <div class="wallet-action-row">
              <button class="wallet-action-btn deposit" onclick="showDepositModal()">
                <i class="fas fa-arrow-down"></i>
                <span data-i18n="btnDeposit">USDT 입금</span>
              </button>
              <button class="wallet-action-btn withdraw" onclick="showWithdrawModal()">
                <i class="fas fa-arrow-up"></i>
                <span data-i18n="btnWithdraw">DEEDRA 출금</span>
              </button>
            </div>
          </div>

          <!-- 거래 내역 -->
          <div class="menu-section">
            <div class="menu-section-title" data-i18n="txHistory">📊 거래 내역</div>
            <div class="tx-tabs">
              <button class="tx-tab active" onclick="switchTxTab('all', this)" data-i18n="txAll">전체</button>
              <button class="tx-tab" onclick="switchTxTab('deposit', this)" data-i18n="txDeposit">입금</button>
              <button class="tx-tab" onclick="switchTxTab('withdrawal', this)" data-i18n="txWithdraw">출금</button>
              <button class="tx-tab" onclick="switchTxTab('invest', this)" data-i18n="txInvest">투자</button>
            </div>
            <div id="txHistoryList" class="tx-list">
              <div class="skeleton-item"></div>
              <div class="skeleton-item"></div>
            </div>
          </div>

          <!-- 공지사항 -->
          <div class="menu-section">
            <div class="menu-section-title" data-i18n="moreAnnouncements">📢 공지사항</div>
            <div id="moreAnnouncementList" class="announcement-list">
              <div class="skeleton-item"></div>
            </div>
          </div>

          <!-- 계정 관리 -->
          <div class="menu-section">
            <div class="menu-section-title" data-i18n="accountMgmt">⚙️ 계정 관리</div>
            <div class="menu-list">
              <div class="menu-item" onclick="showProfileEdit()">
                <div class="menu-item-icon icon-blue"><i class="fas fa-user-edit"></i></div>
                <span class="menu-item-text" data-i18n="profileEdit">프로필 수정</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
              <div class="menu-item" onclick="showPasswordChange()">
                <div class="menu-item-icon icon-gray"><i class="fas fa-lock"></i></div>
                <span class="menu-item-text" data-i18n="passwordChange">비밀번호 변경</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
              <div class="menu-item" onclick="showWithdrawPinSetup()">
                <div class="menu-item-icon icon-gold"><i class="fas fa-key"></i></div>
                <span class="menu-item-text" data-i18n="withdrawPin">출금 PIN 설정</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
              <div class="menu-item" onclick="showTickets()">
                <div class="menu-item-icon icon-green"><i class="fas fa-headset"></i></div>
                <span class="menu-item-text" data-i18n="support">1:1 문의</span>
                <i class="fas fa-chevron-right menu-item-arrow"></i>
              </div>
            </div>
          </div>

          <!-- 설정 -->
          <div class="menu-section">
            <div class="menu-section-title" data-i18n="settings">🔧 설정</div>
            <div class="menu-list">
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-moon"></i></div>
                <span class="menu-item-text" data-i18n="darkMode">다크 모드</span>
                <button class="menu-item-toggle" id="darkModeToggle" onclick="toggleThemeFromMenu()" ></button>
              </div>
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-globe"></i></div>
                <span class="menu-item-text" data-i18n="language">언어</span>
                <select class="lang-select" onchange="changeLang(this.value)">
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="th">ภาษาไทย</option>
                </select>
              </div>
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-bell"></i></div>
                <span class="menu-item-text" data-i18n="notification">알림</span>
                <button class="menu-item-toggle on" id="notiToggle" onclick="toggleNoti(this)"></button>
              </div>
              <div class="menu-item">
                <div class="menu-item-icon icon-gray"><i class="fas fa-info-circle"></i></div>
                <span class="menu-item-text" data-i18n="appVersion">앱 버전</span>
                <span class="menu-item-value">v2.0.0</span>
              </div>
            </div>
          </div>

          <!-- 로그아웃 -->
          <div class="menu-section">
            <div class="menu-list">
              <div class="menu-item danger" onclick="handleLogout()">
                <div class="menu-item-icon"><i class="fas fa-sign-out-alt"></i></div>
                <span class="menu-item-text" data-i18n="logout">로그아웃</span>
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
    <div class="modal-title" data-i18n="modalDeposit">💰 USDT 입금 신청</div>
    <div class="modal-body">
      <div class="info-box">
        <div class="info-label" data-i18n="depositAddrLabel">회사 입금 주소 (TRC20)</div>
        <div class="wallet-address-box">
          <span id="companyWalletAddr" data-i18n="depositAddrLoading">주소 로딩중...</span>
          <button onclick="copyWalletAddress()" class="copy-btn" style="padding:8px 12px;font-size:12px">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="depositAmountLabel">입금 금액 (USDT)</label>
        <input type="number" id="depositAmount" class="form-input" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="depositTxidLabel">TXID (트랜잭션 해시)</label>
        <input type="text" id="depositTxid" class="form-input" placeholder="트랜잭션 해시 입력" data-i18n="depositTxidPlaceholder" data-i18n-attr="placeholder" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="depositMemoLabel">메모 (선택)</label>
        <input type="text" id="depositMemo" class="form-input" placeholder="메모 입력 (선택)" data-i18n="depositMemoPlaceholder" data-i18n-attr="placeholder" />
      </div>
      <div class="warning-box" data-i18n="depositWarning">⚠️ 반드시 위 주소로 입금 후 TXID를 입력해주세요. 관리자 승인 후 잔액이 업데이트됩니다.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('depositModal')" style="flex:1" data-i18n="btnCancel">취소</button>
      <button class="btn btn-primary" onclick="submitDeposit()" style="flex:2" data-i18n="btnSubmitDeposit">입금 신청</button>
    </div>
  </div>
</div>

<!-- DEEDRA 출금 모달 -->
<div id="withdrawModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('withdrawModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalWithdraw">💸 DEEDRA 출금 신청</div>
    <div class="modal-body">
      <div class="info-box">
        <div class="info-label" data-i18n="withdrawAvailLabel">출금 가능 잔액</div>
        <div style="font-size:22px;font-weight:800;color:var(--accent)">
          <span id="withdrawAvailable">0.00</span> DEEDRA
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="withdrawAmountLabel">출금 금액 (DEEDRA)</label>
        <input type="number" id="withdrawAmount" class="form-input" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="withdrawAddressLabel">수신 지갑 주소</label>
        <input type="text" id="withdrawAddress" class="form-input" placeholder="수신 지갑 주소 입력" data-i18n="withdrawAddressPlaceholder" data-i18n-attr="placeholder" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="withdrawPinLabel">출금 PIN (6자리)</label>
        <input type="password" id="withdrawPin" class="form-input" placeholder="●●●●●●" maxlength="6" />
      </div>
      <div class="warning-box" data-i18n="withdrawWarning">⚠️ 출금 신청 후 관리자 승인까지 1~3 영업일 소요됩니다.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('withdrawModal')" style="flex:1" data-i18n="btnCancel">취소</button>
      <button class="btn btn-primary" onclick="submitWithdraw()" style="flex:2" data-i18n="btnSubmitWithdraw">출금 신청</button>
    </div>
  </div>
</div>

<!-- 투자 신청 모달 -->
<div id="investModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('investModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalInvest">📈 투자 신청</div>
    <div class="modal-body">
      <div class="invest-product-summary" id="investProductSummary"></div>
      <div class="form-group">
        <label class="form-label" data-i18n="investAmountLabel">투자 금액 (USDT)</label>
        <input type="number" id="investAmount" class="form-input" placeholder="0.00" oninput="updateInvestPreview()" />
        <div class="input-hint" id="investAmountHint"></div>
      </div>
      <div class="invest-preview" id="investPreview" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('investModal')" style="flex:1" data-i18n="btnCancel">취소</button>
      <button class="btn btn-primary" onclick="submitInvest()" style="flex:2" data-i18n="btnSubmitInvest">투자 신청</button>
    </div>
  </div>
</div>

<!-- 게임 충전 모달 -->
<div id="chargeModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('chargeModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalCharge">🎮 게임 지갑 충전</div>
    <div class="modal-body">
      <div class="info-box">
        <div class="info-label" data-i18n="chargeInfoLabel">DEEDRA 잔액에서 게임 지갑으로 이동</div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">
          <span data-i18n="chargeHolding">보유: </span><span id="chargeAvailable">0.00</span> DEEDRA
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="chargeAmountLabel">충전 금액 (DEEDRA)</label>
        <input type="number" id="chargeAmount" class="form-input" placeholder="0.00" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('chargeModal')" style="flex:1" data-i18n="btnCancel">취소</button>
      <button class="btn btn-primary" onclick="submitCharge()" style="flex:2" data-i18n="btnSubmitCharge">충전</button>
    </div>
  </div>
</div>

<!-- 출금 PIN 모달 -->
<div id="pinModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('pinModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalPin">🔐 출금 PIN 설정</div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label" data-i18n="newPinLabel">새 PIN (6자리)</label>
        <input type="password" id="newPin" class="form-input" placeholder="●●●●●●" maxlength="6" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="confirmPinLabel">PIN 확인</label>
        <input type="password" id="confirmPin" class="form-input" placeholder="●●●●●●" maxlength="6" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('pinModal')" style="flex:1" data-i18n="btnCancel">취소</button>
      <button class="btn btn-primary" onclick="saveWithdrawPin()" style="flex:2" data-i18n="btnSave">저장</button>
    </div>
  </div>
</div>

<!-- 프로필 수정 모달 -->
<div id="profileModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('profileModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalProfile">✏️ 프로필 수정</div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label" data-i18n="labelName">이름</label>
        <input type="text" id="editName" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="labelPhone">연락처</label>
        <input type="text" id="editPhone" class="form-input" placeholder="010-0000-0000" data-i18n="placeholderPhone" data-i18n-attr="placeholder" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('profileModal')" style="flex:1" data-i18n="btnCancel">취소</button>
      <button class="btn btn-primary" onclick="saveProfile()" style="flex:2" data-i18n="btnSave">저장</button>
    </div>
  </div>
</div>

<!-- 1:1 문의 모달 -->
<div id="ticketModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('ticketModal')"></div>
  <div class="modal-sheet large">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalTicket">💬 1:1 문의</div>
    <div class="modal-body">
      <div id="ticketList" class="ticket-list"></div>
      <div class="divider"></div>
      <div class="form-group">
        <label class="form-label" data-i18n="ticketTitleLabel">제목</label>
        <input type="text" id="ticketTitle" class="form-input" placeholder="문의 제목" data-i18n="ticketTitlePlaceholder" data-i18n-attr="placeholder" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="ticketContentLabel">내용</label>
        <textarea id="ticketContent" class="form-input textarea" placeholder="문의 내용을 입력하세요" data-i18n="ticketContentPlaceholder" data-i18n-attr="placeholder"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('ticketModal')" style="flex:1" data-i18n="btnClose">닫기</button>
      <button class="btn btn-primary" onclick="submitTicket()" style="flex:2" data-i18n="btnSubmitTicket">문의 등록</button>
    </div>
  </div>
</div>

<!-- 공지사항 모달 -->
<div id="announcementModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('announcementModal')"></div>
  <div class="modal-sheet large">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalAnnouncement">📢 공지사항</div>
    <div class="modal-body">
      <div id="announcementFullList"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost btn-full" onclick="closeModal('announcementModal')" data-i18n="btnClose">닫기</button>
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
  <title>DEEDRA 초기 데이터 설정</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; padding: 24px; background: #f3f4f6; }
    .card { background: white; padding: 28px; border-radius: 12px; max-width: 560px; margin: 0 auto; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h2 { margin-bottom: 8px; color: #0d47a1; font-size: 20px; }
    p { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
    .btn-row { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
    button { padding: 12px 20px; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; width: 100%; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-all { background: #0d47a1; }
    .btn-products { background: #1565c0; }
    .btn-accounts { background: #283593; }
    .btn-settings { background: #4527a0; }
    .log { background: #111827; color: #d1fae5; padding: 14px; border-radius: 8px; font-size: 12px; font-family: monospace; min-height: 180px; white-space: pre-wrap; margin-top: 14px; overflow-y: auto; max-height: 500px; line-height: 1.6; }
    .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .section-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th { background: #f9fafb; padding: 6px 8px; text-align: left; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
  </style>
</head>
<body>
<div class="card">
  <h2>🛠️ DEEDRA 초기 데이터 설정</h2>
  <p>Firebase Firestore에 투자상품, 테스트 계정, 앱 설정값을 일괄 생성합니다.</p>

  <div class="section">
    <div class="section-title">📦 생성될 투자 상품</div>
    <table>
      <tr><th>이름</th><th>수익률</th><th>기간</th><th>최소</th><th>최대</th></tr>
      <tr><td>Basic</td><td>15%</td><td>30일</td><td>$100</td><td>$1,000</td></tr>
      <tr><td>Standard</td><td>25%</td><td>60일</td><td>$500</td><td>$5,000</td></tr>
      <tr><td>Premium</td><td>40%</td><td>90일</td><td>$1,000</td><td>$20,000</td></tr>
      <tr><td>VIP</td><td>60%</td><td>180일</td><td>$5,000</td><td>$100,000</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">👤 생성될 테스트 계정</div>
    <table>
      <tr><th>이메일</th><th>비밀번호</th><th>직급</th><th>USDT</th><th>DEEDRA</th></tr>
      <tr><td>test1@deedra.com</td><td>Test1234!</td><td>G1</td><td>1,000</td><td>500</td></tr>
      <tr><td>test2@deedra.com</td><td>Test1234!</td><td>G0</td><td>500</td><td>200</td></tr>
      <tr><td>test3@deedra.com</td><td>Test1234!</td><td>G2</td><td>5,000</td><td>2,000</td></tr>
    </table>
    <p style="margin:6px 0 0;font-size:11px;color:#9ca3af">출금 PIN: 123456</p>
  </div>

  <div class="btn-row">
    <button class="btn-all" id="btnAll" onclick="runAll()">🚀 전체 초기화 (상품 + 계정 + 설정)</button>
    <button class="btn-products" id="btnProducts" onclick="createProducts()">📦 투자 상품만 생성</button>
    <button class="btn-accounts" id="btnAccounts" onclick="createTestAccounts()">👤 테스트 계정만 생성</button>
    <button class="btn-settings" id="btnSettings" onclick="createSettings()">⚙️ 앱 설정값만 생성</button>
  </div>
  <div class="log" id="log">버튼을 클릭하면 시작됩니다...</div>
</div>

<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseApp = initializeApp({
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
});
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const PRODUCTS = [
  { id:'product_basic',    name:'Basic',    roiPercent:15, durationDays:30,  minAmount:100,  maxAmount:1000,   isActive:true, order:1 },
  { id:'product_standard', name:'Standard', roiPercent:25, durationDays:60,  minAmount:500,  maxAmount:5000,   isActive:true, order:2 },
  { id:'product_premium',  name:'Premium',  roiPercent:40, durationDays:90,  minAmount:1000, maxAmount:20000,  isActive:true, order:3 },
  { id:'product_vip',      name:'VIP',      roiPercent:60, durationDays:180, minAmount:5000, maxAmount:100000, isActive:true, order:4 },
];

const TEST_ACCOUNTS = [
  { email:'test1@deedra.com', password:'Test1234!', name:'테스트1호', rank:'G1', usdt:1000, dedra:500,  bonus:50,  referralCode:'TEST0001' },
  { email:'test2@deedra.com', password:'Test1234!', name:'테스트2호', rank:'G0', usdt:500,  dedra:200,  bonus:20,  referralCode:'TEST0002' },
  { email:'test3@deedra.com', password:'Test1234!', name:'테스트3호', rank:'G2', usdt:5000, dedra:2000, bonus:300, referralCode:'TEST0003' },
];

function log(msg, color='#d1fae5') {
  const el = document.getElementById('log');
  el.innerHTML += '<span style="color:'+color+'">'+msg+'</span>\\n';
  el.scrollTop = el.scrollHeight;
}

function disableAll(v) {
  ['btnAll','btnProducts','btnAccounts','btnSettings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = v;
  });
}

window.runAll = async function() {
  disableAll(true);
  document.getElementById('log').innerHTML = '';
  log('🚀 전체 초기화 시작...', '#93c5fd');
  await createProducts();
  await createTestAccounts();
  await createSettings();
  log('\\n🎉 전체 초기화 완료!', '#fbbf24');
  disableAll(false);
};

window.createProducts = async function() {
  log('\\n📦 [투자 상품 생성 시작]', '#93c5fd');
  for (const p of PRODUCTS) {
    try {
      await setDoc(doc(db, 'products', p.id), { ...p, createdAt: serverTimestamp() });
      log('  ✅ ' + p.name + ' (' + p.roiPercent + '% / ' + p.durationDays + '일)', '#86efac');
    } catch(e) {
      log('  ❌ ' + p.name + ' 오류: ' + e.message, '#fca5a5');
    }
  }
  log('📦 투자 상품 4종 생성 완료', '#86efac');
};

window.createTestAccounts = async function() {
  log('\\n👤 [테스트 계정 생성 시작]', '#93c5fd');
  for (const a of TEST_ACCOUNTS) {
    log('  처리중: ' + a.email, '#e5e7eb');
    try {
      let uid;
      try {
        const c = await createUserWithEmailAndPassword(auth, a.email, a.password);
        uid = c.user.uid;
        log('    ✅ 신규 계정 생성', '#86efac');
      } catch(e) {
        if (e.code === 'auth/email-already-in-use') {
          const c = await signInWithEmailAndPassword(auth, a.email, a.password);
          uid = c.user.uid;
          log('    ℹ️ 기존 계정 업데이트', '#93c5fd');
        } else throw e;
      }
      await setDoc(doc(db,'users',uid), {
        uid, email:a.email, name:a.name, role:'member', rank:a.rank,
        status:'active', referralCode:a.referralCode, referredBy:null,
        phone:'', withdrawPin:btoa('123456'), referralCount:0,
        createdAt:serverTimestamp()
      }, {merge:true});
      await setDoc(doc(db,'wallets',uid), {
        userId:uid, usdtBalance:a.usdt, dedraBalance:a.dedra,
        bonusBalance:a.bonus, totalDeposit:a.usdt, totalWithdrawal:0,
        totalEarnings:a.bonus, createdAt:serverTimestamp()
      }, {merge:true});
      log('    ✅ Firestore 저장 (USDT:' + a.usdt + ' DEEDRA:' + a.dedra + ')', '#86efac');
    } catch(e) {
      log('    ❌ 오류: ' + e.message, '#fca5a5');
    }
  }
  log('👤 테스트 계정 3개 완료 (PIN: 123456)', '#86efac');
};

window.createSettings = async function() {
  log('\\n⚙️ [앱 설정값 생성 시작]', '#93c5fd');
  try {
    // DEEDRA 시세 설정
    await setDoc(doc(db, 'settings', 'deedraPrice'), {
      price: 0.50,
      updatedAt: serverTimestamp(),
      updatedBy: 'system',
      note: '초기 설정값 (관리자가 변경 가능)'
    });
    log('  ✅ DEEDRA 시세: $0.50', '#86efac');

    // 회사 지갑 주소
    await setDoc(doc(db, 'settings', 'wallets'), {
      trc20: 'TRX_WALLET_ADDRESS_SET_BY_ADMIN',
      updatedAt: serverTimestamp(),
      note: '관리자가 실제 주소로 변경 필요'
    });
    log('  ✅ 회사 지갑 주소 (기본값)', '#86efac');

    // 공지사항 샘플
    await addDoc(collection(db, 'announcements'), {
      title: '🎉 DEEDRA 앱 v2.0 오픈!',
      content: 'DEEDRA 투자 앱이 새로운 디자인으로 리뉴얼되었습니다. 더 편리해진 UI로 투자를 시작해보세요!',
      isActive: true,
      isPinned: true,
      createdAt: serverTimestamp()
    });
    await addDoc(collection(db, 'announcements'), {
      title: '📋 투자 상품 안내',
      content: 'Basic(15%/30일), Standard(25%/60일), Premium(40%/90일), VIP(60%/180일) 상품이 출시되었습니다.',
      isActive: true,
      isPinned: false,
      createdAt: serverTimestamp()
    });
    log('  ✅ 공지사항 2건 생성', '#86efac');
    log('⚙️ 앱 설정값 생성 완료', '#86efac');
  } catch(e) {
    log('  ❌ 오류: ' + e.message, '#fca5a5');
  }
};
</script>
</body>
</html>`

export default app
