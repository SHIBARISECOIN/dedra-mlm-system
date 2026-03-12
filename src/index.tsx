import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Static files
app.use('/static/*', serveStatic({ root: './' }))

// ─── Main App (SPA) ───────────────────────────────────────────────────────────
const HTML = () => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>DEEDRA</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body>
  <div id="app">
    <!-- 로딩 화면 -->
    <div id="loadingScreen" class="loading-screen">
      <div class="loading-logo">💎</div>
      <div class="loading-text">DEEDRA</div>
      <div class="spinner"></div>
    </div>

    <!-- 인증 화면 -->
    <div id="authScreen" class="screen hidden">
      <div class="auth-container">
        <div class="auth-logo">💎 DEEDRA</div>
        <div class="auth-tabs">
          <button class="auth-tab active" id="loginTab" onclick="switchAuthTab('login')">로그인</button>
          <button class="auth-tab" id="registerTab" onclick="switchAuthTab('register')">회원가입</button>
        </div>

        <!-- 로그인 폼 -->
        <div id="loginForm">
          <div class="form-group">
            <label class="form-label">이메일</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="이메일 입력" />
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="비밀번호 입력" />
          </div>
          <button class="btn btn-primary btn-full" onclick="handleLogin()">로그인</button>
          <button class="btn btn-ghost btn-full mt-8" onclick="handleForgotPassword()">비밀번호 찾기</button>
        </div>

        <!-- 회원가입 폼 -->
        <div id="registerForm" class="hidden">
          <div class="form-group">
            <label class="form-label">이름</label>
            <input type="text" id="regName" class="form-input" placeholder="이름 입력" />
          </div>
          <div class="form-group">
            <label class="form-label">이메일</label>
            <input type="email" id="regEmail" class="form-input" placeholder="이메일 입력" />
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호</label>
            <input type="password" id="regPassword" class="form-input" placeholder="비밀번호 8자 이상" />
          </div>
          <div class="form-group">
            <label class="form-label">추천인 코드 <span class="required">*필수</span></label>
            <input type="text" id="regReferral" class="form-input" placeholder="추천인 코드 입력" />
          </div>
          <button class="btn btn-primary btn-full" onclick="handleRegister()">회원가입</button>
        </div>
      </div>
    </div>

    <!-- 메인 앱 화면 -->
    <div id="mainApp" class="screen hidden">
      <!-- 상단 헤더 -->
      <div class="app-header">
        <div class="header-left">
          <span class="header-logo">💎 DEEDRA</span>
        </div>
        <div class="header-right">
          <button class="icon-btn" onclick="showNotifications()">
            <i class="fas fa-bell"></i>
            <span class="badge-dot hidden" id="notiBadge"></span>
          </button>
        </div>
      </div>

      <!-- 페이지 컨테이너 -->
      <div class="page-container" id="pageContainer">
        <!-- 홈 페이지 -->
        <div id="homePage" class="page active">
          <div class="page-scroll">
            <!-- 사용자 인사 -->
            <div class="greeting-section">
              <div class="greeting-text">
                <span id="greetingMsg">안녕하세요</span> 👋
                <div class="user-name-display" id="userNameDisplay">-</div>
              </div>
              <div class="rank-badge" id="userRankBadge">G0</div>
            </div>

            <!-- 자산 카드 -->
            <div class="asset-card">
              <div class="asset-card-title">총 자산</div>
              <div class="asset-total" id="totalAsset">$0.00</div>
              <div class="asset-row">
                <div class="asset-item">
                  <div class="asset-label">USDT</div>
                  <div class="asset-value" id="usdtBalance">0.00</div>
                </div>
                <div class="asset-divider"></div>
                <div class="asset-item">
                  <div class="asset-label">DEEDRA</div>
                  <div class="asset-value" id="dedraBalance">0.00</div>
                </div>
                <div class="asset-divider"></div>
                <div class="asset-item">
                  <div class="asset-label">보너스</div>
                  <div class="asset-value" id="bonusBalance">0.00</div>
                </div>
              </div>
              <div class="asset-actions">
                <button class="asset-btn" onclick="switchPage('wallet')">
                  <i class="fas fa-arrow-down"></i> 입금
                </button>
                <button class="asset-btn" onclick="switchPage('wallet')">
                  <i class="fas fa-arrow-up"></i> 출금
                </button>
              </div>
            </div>

            <!-- 빠른 메뉴 -->
            <div class="quick-menu">
              <div class="quick-item" onclick="switchPage('invest')">
                <div class="quick-icon invest">📈</div>
                <div class="quick-label">투자하기</div>
              </div>
              <div class="quick-item" onclick="switchPage('referral')">
                <div class="quick-icon referral">👥</div>
                <div class="quick-label">추천인</div>
              </div>
              <div class="quick-item" onclick="switchPage('game')">
                <div class="quick-icon game">🎮</div>
                <div class="quick-label">게임</div>
              </div>
              <div class="quick-item" onclick="switchPage('mypage')">
                <div class="quick-icon mypage">👤</div>
                <div class="quick-label">마이페이지</div>
              </div>
            </div>

            <!-- 공지사항 -->
            <div class="section-header">
              <span class="section-title">📢 공지사항</span>
              <button class="see-all-btn" onclick="showAnnouncements()">전체보기</button>
            </div>
            <div id="announcementList" class="announcement-list">
              <div class="skeleton-item"></div>
              <div class="skeleton-item"></div>
            </div>

            <!-- 최근 거래 -->
            <div class="section-header">
              <span class="section-title">💳 최근 거래</span>
              <button class="see-all-btn" onclick="switchPage('wallet')">전체보기</button>
            </div>
            <div id="recentTxList" class="tx-list">
              <div class="skeleton-item"></div>
              <div class="skeleton-item"></div>
            </div>
          </div>
        </div>

        <!-- 지갑 페이지 -->
        <div id="walletPage" class="page">
          <div class="page-scroll">
            <div class="page-title-bar">
              <h2 class="page-title">💰 지갑</h2>
            </div>

            <!-- 잔액 카드 -->
            <div class="wallet-balance-card">
              <div class="wb-item">
                <div class="wb-icon usdt-icon">₮</div>
                <div class="wb-info">
                  <div class="wb-label">USDT 잔액</div>
                  <div class="wb-value" id="walletUsdt">0.00</div>
                </div>
              </div>
              <div class="wb-item">
                <div class="wb-icon dedra-icon">💎</div>
                <div class="wb-info">
                  <div class="wb-label">DEEDRA 잔액</div>
                  <div class="wb-value" id="walletDedra">0.00</div>
                </div>
              </div>
              <div class="wb-item">
                <div class="wb-icon bonus-icon">🎁</div>
                <div class="wb-info">
                  <div class="wb-label">보너스 잔액</div>
                  <div class="wb-value" id="walletBonus">0.00</div>
                </div>
              </div>
            </div>

            <!-- 입출금 버튼 -->
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

            <!-- 거래 내역 탭 -->
            <div class="tx-tabs">
              <button class="tx-tab active" onclick="switchTxTab('all', this)">전체</button>
              <button class="tx-tab" onclick="switchTxTab('deposit', this)">입금</button>
              <button class="tx-tab" onclick="switchTxTab('withdrawal', this)">출금</button>
            </div>
            <div id="txHistoryList" class="tx-list">
              <div class="skeleton-item"></div>
              <div class="skeleton-item"></div>
              <div class="skeleton-item"></div>
            </div>
          </div>
        </div>

        <!-- 투자 페이지 -->
        <div id="investPage" class="page">
          <div class="page-scroll">
            <div class="page-title-bar">
              <h2 class="page-title">📈 투자</h2>
            </div>

            <!-- 내 투자 현황 -->
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

            <!-- 투자 상품 목록 -->
            <div class="section-header">
              <span class="section-title">💼 투자 상품</span>
            </div>
            <div id="productList" class="product-list">
              <div class="skeleton-item tall"></div>
              <div class="skeleton-item tall"></div>
            </div>

            <!-- 내 투자 목록 -->
            <div class="section-header mt-16">
              <span class="section-title">📋 내 투자 현황</span>
            </div>
            <div id="myInvestList" class="invest-list">
              <div class="skeleton-item"></div>
            </div>
          </div>
        </div>

        <!-- 게임 페이지 -->
        <div id="gamePage" class="page">
          <div class="page-scroll">
            <div class="page-title-bar">
              <h2 class="page-title">🎮 게임</h2>
            </div>
            <div class="game-balance-bar">
              <span>게임 잔액: <strong id="gameBalance">0.00</strong> DEEDRA</span>
            </div>
            <div class="game-grid">
              <div class="game-card" onclick="startGame('oddeven')">
                <div class="game-icon">🎲</div>
                <div class="game-name">홀짝</div>
                <div class="game-desc">DEEDRA로 베팅</div>
              </div>
              <div class="game-card" onclick="startGame('dice')">
                <div class="game-icon">🎯</div>
                <div class="game-name">주사위</div>
                <div class="game-desc">숫자를 맞춰라</div>
              </div>
              <div class="game-card" onclick="startGame('slot')">
                <div class="game-icon">🎰</div>
                <div class="game-name">슬롯머신</div>
                <div class="game-desc">잭팟을 노려라</div>
              </div>
              <div class="game-card coming-soon" onclick="showComingSoon()">
                <div class="game-icon">🃏</div>
                <div class="game-name">바카라</div>
                <div class="game-desc coming">준비중</div>
              </div>
            </div>

            <!-- 게임 화면 (홀짝) -->
            <div id="gameOddEven" class="game-area hidden">
              <div class="game-title-bar">
                <span>🎲 홀짝 게임</span>
                <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
              </div>
              <div class="game-body">
                <div class="bet-display">베팅: <span id="oeCurrentBet">0</span> DEEDRA</div>
                <div class="bet-slider-row">
                  <button onclick="adjustBet('oe', -10)">-10</button>
                  <input type="range" id="oeBetSlider" min="1" max="1000" value="10" oninput="updateBetDisplay('oe', this.value)" />
                  <button onclick="adjustBet('oe', 10)">+10</button>
                </div>
                <div class="bet-quick-row">
                  <button onclick="setBetAmount('oe', 10)">10</button>
                  <button onclick="setBetAmount('oe', 50)">50</button>
                  <button onclick="setBetAmount('oe', 100)">100</button>
                  <button onclick="setBetAmount('oe', 500)">500</button>
                </div>
                <div class="choice-row">
                  <button class="choice-btn odd" onclick="playOddEven('odd')">홀 (Odd)</button>
                  <button class="choice-btn even" onclick="playOddEven('even')">짝 (Even)</button>
                </div>
                <div id="oeResult" class="game-result hidden"></div>
              </div>
            </div>

            <!-- 게임 화면 (주사위) -->
            <div id="gameDice" class="game-area hidden">
              <div class="game-title-bar">
                <span>🎯 주사위 게임</span>
                <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
              </div>
              <div class="game-body">
                <div class="bet-display">베팅: <span id="diceCurrentBet">0</span> DEEDRA</div>
                <div class="bet-slider-row">
                  <button onclick="adjustBet('dice', -10)">-10</button>
                  <input type="range" id="diceBetSlider" min="1" max="1000" value="10" oninput="updateBetDisplay('dice', this.value)" />
                  <button onclick="adjustBet('dice', 10)">+10</button>
                </div>
                <div class="dice-choices">
                  <div id="diceDisplay" class="dice-display">🎲</div>
                  <div class="dice-number-row">
                    ${[1,2,3,4,5,6].map(n => `<button class="dice-num-btn" onclick="playDice(${n})">${n}</button>`).join('')}
                  </div>
                </div>
                <div id="diceResult" class="game-result hidden"></div>
              </div>
            </div>

            <!-- 게임 화면 (슬롯) -->
            <div id="gameSlot" class="game-area hidden">
              <div class="game-title-bar">
                <span>🎰 슬롯머신</span>
                <button onclick="closeGame()" class="close-game-btn"><i class="fas fa-times"></i></button>
              </div>
              <div class="game-body">
                <div class="bet-display">베팅: <span id="slotCurrentBet">0</span> DEEDRA</div>
                <div class="bet-slider-row">
                  <button onclick="adjustBet('slot', -10)">-10</button>
                  <input type="range" id="slotBetSlider" min="1" max="1000" value="10" oninput="updateBetDisplay('slot', this.value)" />
                  <button onclick="adjustBet('slot', 10)">+10</button>
                </div>
                <div class="slot-machine">
                  <div class="slot-reel" id="reel1">🍋</div>
                  <div class="slot-reel" id="reel2">🍋</div>
                  <div class="slot-reel" id="reel3">🍋</div>
                </div>
                <button class="btn btn-primary btn-full mt-16" onclick="playSpin()" id="spinBtn">🎰 스핀!</button>
                <div id="slotResult" class="game-result hidden"></div>
              </div>
            </div>

            <!-- 게임 기록 -->
            <div class="section-header mt-16">
              <span class="section-title">📋 최근 게임 기록</span>
            </div>
            <div id="gameLogList" class="tx-list">
              <div class="empty-state">게임을 시작해보세요!</div>
            </div>
          </div>
        </div>

        <!-- 마이페이지 -->
        <div id="mypagePage" class="page">
          <div class="page-scroll">
            <div class="page-title-bar">
              <h2 class="page-title">👤 마이페이지</h2>
            </div>

            <!-- 프로필 카드 -->
            <div class="profile-card">
              <div class="profile-avatar">👤</div>
              <div class="profile-info">
                <div class="profile-name" id="profileName">-</div>
                <div class="profile-email" id="profileEmail">-</div>
                <div class="profile-rank" id="profileRank">G0</div>
              </div>
            </div>

            <!-- 추천 코드 -->
            <div class="referral-card">
              <div class="referral-label">내 추천 코드</div>
              <div class="referral-code-row">
                <span class="referral-code" id="myReferralCode">-</span>
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
              <div class="rank-title">직급 현황</div>
              <div class="rank-current" id="rankCurrent">G0</div>
              <div class="rank-progress-label">다음 직급까지: <span id="rankNextLabel">G1 (3명 필요)</span></div>
              <div class="rank-progress-bar">
                <div class="rank-progress-fill" id="rankProgressFill" style="width: 0%"></div>
              </div>
              <div class="rank-referral-count">직접 추천: <strong id="rankReferralCount">0</strong>명</div>
            </div>

            <!-- 메뉴 목록 -->
            <div class="mypage-menu">
              <div class="mypage-menu-item" onclick="showProfileEdit()">
                <i class="fas fa-user-edit"></i>
                <span>프로필 수정</span>
                <i class="fas fa-chevron-right arrow"></i>
              </div>
              <div class="mypage-menu-item" onclick="showPasswordChange()">
                <i class="fas fa-lock"></i>
                <span>비밀번호 변경</span>
                <i class="fas fa-chevron-right arrow"></i>
              </div>
              <div class="mypage-menu-item" onclick="showWithdrawPinSetup()">
                <i class="fas fa-key"></i>
                <span>출금 PIN 설정</span>
                <i class="fas fa-chevron-right arrow"></i>
              </div>
              <div class="mypage-menu-item" onclick="showTickets()">
                <i class="fas fa-headset"></i>
                <span>1:1 문의</span>
                <i class="fas fa-chevron-right arrow"></i>
              </div>
              <div class="mypage-menu-item danger" onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i>
                <span>로그아웃</span>
                <i class="fas fa-chevron-right arrow"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 하단 탭 네비게이션 -->
      <nav class="bottom-nav">
        <button class="nav-item active" id="nav-home" onclick="switchPage('home')">
          <i class="fas fa-home"></i>
          <span>홈</span>
        </button>
        <button class="nav-item" id="nav-wallet" onclick="switchPage('wallet')">
          <i class="fas fa-wallet"></i>
          <span>지갑</span>
        </button>
        <button class="nav-item" id="nav-invest" onclick="switchPage('invest')">
          <i class="fas fa-chart-line"></i>
          <span>투자</span>
        </button>
        <button class="nav-item" id="nav-game" onclick="switchPage('game')">
          <i class="fas fa-gamepad"></i>
          <span>게임</span>
        </button>
        <button class="nav-item" id="nav-mypage" onclick="switchPage('mypage')">
          <i class="fas fa-user"></i>
          <span>마이</span>
        </button>
      </nav>
    </div>
  </div>

  <!-- ===== 모달들 ===== -->

  <!-- USDT 입금 모달 -->
  <div id="depositModal" class="modal hidden">
    <div class="modal-overlay" onclick="closeModal('depositModal')"></div>
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">💰 USDT 입금 신청</div>
      <div class="modal-body">
        <div class="info-box">
          <div class="info-label">회사 지갑 주소 (TRC20)</div>
          <div class="wallet-address-box">
            <span id="companyWalletAddr">TRC20 주소 로딩중...</span>
            <button onclick="copyWalletAddress()" class="copy-btn"><i class="fas fa-copy"></i></button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">입금 금액 (USDT)</label>
          <input type="number" id="depositAmount" class="form-input" placeholder="0.00" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label class="form-label">TXID (트랜잭션 해시)</label>
          <input type="text" id="depositTxid" class="form-input" placeholder="0x..." />
        </div>
        <div class="form-group">
          <label class="form-label">메모 (선택)</label>
          <input type="text" id="depositMemo" class="form-input" placeholder="메모 입력" />
        </div>
        <div class="warning-box">
          ⚠️ 반드시 위 주소로 입금 후 TXID를 입력해주세요. 관리자 승인 후 잔액이 업데이트됩니다.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('depositModal')">취소</button>
        <button class="btn btn-primary" onclick="submitDeposit()">입금 신청</button>
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
          <span>출금 가능: <strong id="withdrawAvailable">0.00</strong> DEEDRA</span>
        </div>
        <div class="form-group">
          <label class="form-label">출금 금액 (DEEDRA)</label>
          <input type="number" id="withdrawAmount" class="form-input" placeholder="0.00" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label class="form-label">출금 지갑 주소</label>
          <input type="text" id="withdrawAddress" class="form-input" placeholder="수신 지갑 주소" />
        </div>
        <div class="form-group">
          <label class="form-label">출금 PIN (6자리)</label>
          <input type="password" id="withdrawPin" class="form-input" placeholder="●●●●●●" maxlength="6" />
        </div>
        <div class="warning-box">
          ⚠️ 출금 신청 후 관리자 승인까지 1~3 영업일이 소요됩니다.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('withdrawModal')">취소</button>
        <button class="btn btn-primary" onclick="submitWithdraw()">출금 신청</button>
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
          <input type="number" id="investAmount" class="form-input" placeholder="0.00" min="0" step="0.01" />
          <div class="input-hint" id="investAmountHint"></div>
        </div>
        <div class="invest-preview" id="investPreview"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('investModal')">취소</button>
        <button class="btn btn-primary" onclick="submitInvest()">투자 신청</button>
      </div>
    </div>
  </div>

  <!-- 출금 PIN 설정 모달 -->
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
        <button class="btn btn-ghost" onclick="closeModal('pinModal')">취소</button>
        <button class="btn btn-primary" onclick="saveWithdrawPin()">저장</button>
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
          <input type="text" id="editName" class="form-input" placeholder="이름" />
        </div>
        <div class="form-group">
          <label class="form-label">연락처</label>
          <input type="text" id="editPhone" class="form-input" placeholder="연락처" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('profileModal')">취소</button>
        <button class="btn btn-primary" onclick="saveProfile()">저장</button>
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
        <div class="new-ticket-form">
          <div class="form-group">
            <label class="form-label">제목</label>
            <input type="text" id="ticketTitle" class="form-input" placeholder="문의 제목" />
          </div>
          <div class="form-group">
            <label class="form-label">내용</label>
            <textarea id="ticketContent" class="form-input textarea" placeholder="문의 내용을 입력하세요"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('ticketModal')">닫기</button>
        <button class="btn btn-primary" onclick="submitTicket()">문의 등록</button>
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
        <button class="btn btn-ghost" onclick="closeModal('announcementModal')">닫기</button>
      </div>
    </div>
  </div>

  <!-- Toast 메시지 -->
  <div id="toast" class="toast hidden"></div>

  <!-- Firebase SDK -->
  <script type="module" src="/static/firebase.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>`

app.get('/', (c) => c.html(HTML()))
app.get('/app', (c) => c.html(HTML()))

export default app
