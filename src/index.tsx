import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
// @ts-ignore
import ADMIN_HTML from '../public/static/admin.html?raw'

const app = new Hono()

// Static files - no-cache 헤더 추가
app.use('/static/*', async (c, next) => {
  await next()
  c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.res.headers.set('Pragma', 'no-cache')
  c.res.headers.set('Expires', '0')
})
app.use('/static/*', serveStatic({ root: './' }))

// favicon.ico - /static/favicon.ico로 리다이렉트
app.get('/favicon.ico', (c) => c.redirect('/static/favicon.ico', 301))

// PWA 파일 서빙
app.use('/manifest.json', serveStatic({ root: './', path: './public/manifest.json' }))
app.use('/sw.js', async (c, next) => {
  await next()
  c.res.headers.set('Content-Type', 'application/javascript')
  c.res.headers.set('Service-Worker-Allowed', '/')
})
app.use('/sw.js', serveStatic({ root: './', path: './public/sw.js' }))

// ─── Firebase Auth 프록시 (sandbox 도메인 우회) ───────────────────────
const FIREBASE_API_KEY = 'AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8'

app.use('/api/auth/*', cors())

// 로그인 프록시
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  )
  const data = await res.json() as any
  if (!res.ok) {
    return c.json({ error: data?.error?.message || 'UNKNOWN_ERROR' }, 400)
  }
  return c.json({
    idToken: data.idToken,
    localId: data.localId,
    email: data.email,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn
  })
})

// 회원가입 프록시
app.post('/api/auth/register', async (c) => {
  const { email, password } = await c.req.json()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  )
  const data = await res.json() as any
  if (!res.ok) {
    return c.json({ error: data?.error?.message || 'UNKNOWN_ERROR' }, 400)
  }
  return c.json({
    idToken: data.idToken,
    localId: data.localId,
    email: data.email,
    refreshToken: data.refreshToken
  })
})

// 테스트 계정 생성 페이지
app.get('/setup', (c) => c.html(SETUP_HTML()))

// 관리자 페이지 - /admin 에서 직접 서빙
app.get('/admin', (c) => c.html(ADMIN_HTML))
app.get('/admin.html', (c) => c.html(ADMIN_HTML))

// ─── DEEDRA 실시간 가격 프록시 API ─────────────────────────────────────────
// CORS 문제 없이 클라이언트→백엔드→DexScreener/Jupiter 형태로 중계
app.use('/api/price/*', cors())

// DexScreener: 토큰 민트 주소로 가격 조회
// GET /api/price/dexscreener?mint=<SOLANA_MINT_ADDRESS>
app.get('/api/price/dexscreener', async (c) => {
  const mint = c.req.query('mint')
  if (!mint) return c.json({ success: false, error: 'mint address required' }, 400)
  try {
    const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`)
    const data: any = await res.json()
    // DexScreener 응답: 배열 형태, 가장 유동성 높은 pair 사용
    const pairs: any[] = Array.isArray(data) ? data : (data.pairs || [])
    if (!pairs.length) return c.json({ success: false, error: 'no pairs found' })
    // 거래량 기준 내림차순 정렬
    pairs.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
    const best = pairs[0]
    return c.json({
      success: true,
      price: parseFloat(best.priceUsd || '0'),
      priceChange24h: best.priceChange?.h24 || 0,
      volume24h: best.volume?.h24 || 0,
      liquidity: best.liquidity?.usd || 0,
      pairAddress: best.pairAddress,
      dexId: best.dexId,
      source: 'dexscreener',
      updatedAt: Date.now()
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Jupiter Price API: 토큰 민트 주소로 가격 조회
// GET /api/price/jupiter?mint=<SOLANA_MINT_ADDRESS>
app.get('/api/price/jupiter', async (c) => {
  const mint = c.req.query('mint')
  if (!mint) return c.json({ success: false, error: 'mint address required' }, 400)
  try {
    const url = `https://api.jup.ag/price/v2?ids=${mint}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) throw new Error(`Jupiter HTTP ${res.status}`)
    const data: any = await res.json()
    const tokenData = data.data?.[mint]
    if (!tokenData) return c.json({ success: false, error: 'token not found on Jupiter' })
    return c.json({
      success: true,
      price: parseFloat(tokenData.price || '0'),
      priceChange24h: null,
      source: 'jupiter',
      updatedAt: Date.now()
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 통합 가격 조회 엔드포인트
// GET /api/price/token?pair=<PAIR_ADDRESS>  (페어 주소 우선)
// GET /api/price/token?mint=<MINT_ADDRESS>  (민트 주소 폴백)
app.get('/api/price/token', async (c) => {
  const pair = c.req.query('pair')
  const mint = c.req.query('mint')
  if (!pair && !mint) return c.json({ success: false, error: 'pair or mint address required' }, 400)

  // 1순위: DexScreener 페어 주소 직접 조회 (가장 정확)
  if (pair) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const data: any = await res.json()
        const p = data.pair || (data.pairs && data.pairs[0])
        if (p) {
          const price = parseFloat(p.priceUsd || '0')
          if (price > 0) {
            return c.json({
              success: true,
              price,
              priceChange24h: p.priceChange?.h24 || 0,
              volume24h: p.volume?.h24 || 0,
              liquidity: p.liquidity?.usd || 0,
              pairAddress: p.pairAddress,
              baseToken: p.baseToken,
              source: 'dexscreener_pair',
              updatedAt: Date.now()
            })
          }
        }
      }
    } catch (_) {}
  }

  // 2순위: DexScreener 민트 주소 토큰 조회
  if (mint) {
    try {
      const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const data: any = await res.json()
        const pairs: any[] = Array.isArray(data) ? data : (data.pairs || [])
        if (pairs.length) {
          pairs.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
          const best = pairs[0]
          const price = parseFloat(best.priceUsd || '0')
          if (price > 0) {
            return c.json({
              success: true,
              price,
              priceChange24h: best.priceChange?.h24 || 0,
              volume24h: best.volume?.h24 || 0,
              liquidity: best.liquidity?.usd || 0,
              source: 'dexscreener',
              updatedAt: Date.now()
            })
          }
        }
      }
    } catch (_) {}
  }

  // 3순위: GeckoTerminal (민트 주소)
  if (mint) {
    try {
      const url = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const data: any = await res.json()
        const attrs = data.data?.attributes
        if (attrs) {
          const price = parseFloat(attrs.price_usd || '0')
          if (price > 0) {
            return c.json({
              success: true,
              price,
              priceChange24h: attrs.price_change_percentage?.h24 || null,
              volume24h: attrs.volume_usd?.h24 || 0,
              source: 'geckoterminal',
              updatedAt: Date.now()
            })
          }
        }
      }
    } catch (_) {}
  }

  return c.json({ success: false, error: 'price not available from any source' }, 404)
})


// ─── Main App (SPA) ───────────────────────────────────────────────────────────
const HTML = () => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>DEEDRA</title>
  <link rel="icon" href="/static/favicon.ico" />
  <!-- PWA -->
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0a0f1e" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="DEEDRA" />
  <link rel="apple-touch-icon" href="/static/favicon.ico" />
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
        <p class="auth-tagline" data-i18n="authTagline">🔐 안전하고 스마트한 FREEZE 자산 운용</p>
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
          <!-- 이름 + 전화번호 (2열) -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" data-i18n="labelName">이름 <span style="color:#ef4444">*</span></label>
              <input type="text" id="regName" class="form-input" placeholder="홍길동" data-i18n="placeholderName" data-i18n-attr="placeholder" />
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" data-i18n="labelPhone">전화번호 <span style="color:#ef4444">*</span></label>
              <input type="tel" id="regPhone" class="form-input" placeholder="010-0000-0000" />
            </div>
          </div>
          <div class="form-group" style="margin-top:10px">
            <label class="form-label" data-i18n="labelEmail">이메일 <span style="color:#ef4444">*</span></label>
            <input type="email" id="regEmail" class="form-input" placeholder="이메일을 입력하세요" data-i18n="placeholderEmail" data-i18n-attr="placeholder" />
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="labelPassword">비밀번호 <span style="color:#ef4444">*</span></label>
            <input type="password" id="regPassword" class="form-input" placeholder="4자리 이상 입력하세요" data-i18n="placeholderPasswordMin" data-i18n-attr="placeholder" />
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="labelCountry">국가 <span style="color:#ef4444">*</span></label>
            <select id="regCountry" class="form-input" style="appearance:none;-webkit-appearance:none;cursor:pointer;">
              <option value="">-- 국가 선택 --</option>
              <option value="KR">🇰🇷 대한민국</option>
              <option value="US">🇺🇸 미국</option>
              <option value="JP">🇯🇵 일본</option>
              <option value="CN">🇨🇳 중국</option>
              <option value="VN">🇻🇳 베트남</option>
              <option value="TH">🇹🇭 태국</option>
              <option value="PH">🇵🇭 필리핀</option>
              <option value="ID">🇮🇩 인도네시아</option>
              <option value="MY">🇲🇾 말레이시아</option>
              <option value="SG">🇸🇬 싱가포르</option>
              <option value="AU">🇦🇺 호주</option>
              <option value="GB">🇬🇧 영국</option>
              <option value="DE">🇩🇪 독일</option>
              <option value="FR">🇫🇷 프랑스</option>
              <option value="CA">🇨🇦 캐나다</option>
              <option value="IN">🇮🇳 인도</option>
              <option value="BR">🇧🇷 브라질</option>
              <option value="RU">🇷🇺 러시아</option>
              <option value="UAE">🇦🇪 UAE</option>
              <option value="OTHER">🌐 기타</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">
              <span data-i18n="labelReferral">추천인 코드</span>
              <span style="color:#ef4444;font-size:11px;margin-left:4px;" data-i18n="referralRequired">* 필수</span>
            </label>
            <div style="position:relative;">
              <input type="text" id="regReferral" class="form-input" placeholder="추천인 코드를 입력하세요"
                data-i18n="placeholderReferral" data-i18n-attr="placeholder"
                style="text-transform:uppercase;letter-spacing:2px;font-weight:700;padding-right:68px;" />
              <div id="refCodeStatus" style="position:absolute;right:38px;top:50%;transform:translateY(-50%);font-size:12px;"></div>
              <button type="button" id="refCodeClearBtn" onclick="clearRefCode()" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.12);border:none;color:#94a3b8;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;padding:0;align-items:center;justify-content:center;" title="지우기">✕</button>
            </div>
            <div id="refCodeHint" style="font-size:11px;color:#64748b;margin-top:4px;"></div>
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
            <div class="asset-total-label" data-i18n="totalAssetLabel">총 자산 (USDT 환산)</div>
            <div class="asset-total-amount" id="totalAsset">0.00 USDT</div>
            <div class="asset-total-sub" id="totalAssetKrw">≈ ₩0</div>

            <!-- 원금 / 수익(출금가능DDRA) 2분할 -->
            <div class="asset-split-row">
              <div class="asset-split-item">
                <div class="asset-split-icon">🔒</div>
                <div class="asset-split-label" data-i18n="assetLocked">USDT 원금</div>
                <div class="asset-split-value" id="splitUsdt">0.00 USDT</div>
                <div class="asset-split-sub" style="color:#94a3b8;font-size:11px;">FREEZE 중</div>
              </div>
              <div class="asset-split-item" style="border-left:1px solid rgba(255,255,255,0.08);">
                <div class="asset-split-icon">💎</div>
                <div class="asset-split-label" style="color:#f59e0b;font-weight:600;">출금 가능 DDRA</div>
                <div class="asset-split-value" id="splitBonus" style="color:#f59e0b;font-size:18px;font-weight:700;">0.00 DDRA</div>
                <div class="asset-split-sub" id="splitBonusDdra" style="color:#94a3b8;font-size:11px;">≈ $0.00 USDT</div>
              </div>
            </div>

            <!-- 입출금 버튼 -->
            <div class="asset-action-row">
              <button class="asset-action-btn deposit" onclick="showDepositModal()">
                <i class="fas fa-arrow-down"></i> <span data-i18n="btnDeposit">USDT 입금</span>
              </button>
              <button class="asset-action-btn withdraw" onclick="showWithdrawModal()">
                <i class="fas fa-arrow-up"></i> <span data-i18n="btnWithdraw">DDRA 출금</span>
              </button>
            </div>
          </div>

          <!-- 홈 분할 패널: 왼쪽 DDRA 시세 / 오른쪽 EARN -->
          <div class="home-split-panel">
            <!-- 왼쪽: DDRA 현재 시세 -->
            <div class="split-left">
              <div class="split-label">💎 DDRA 현재 시세</div>
              <div class="split-price" id="deedraPrice">$0.50</div>
              <div class="split-price-sub" id="deedraChange">1 DDRA = $0.5000</div>
              <div class="split-price-updated" id="deedraUpdated"></div>
            </div>
            <!-- 오른쪽: EARN 상품 -->
            <div class="split-right">
              <div class="split-earn-header">
                <span class="split-earn-title">EARN</span>
                <button class="split-earn-more" onclick="switchPage('invest')">전체보기 ›</button>
              </div>
              <div id="homeEarnList" class="home-earn-list">
                <div class="earn-skeleton"></div>
                <div class="earn-skeleton"></div>
              </div>
            </div>
          </div>

          <!-- D-Day 투자 현황 -->
          <div id="ddayCard" class="dday-card hidden">
            <div class="dday-header">
              <div class="dday-title" data-i18n="investingNow">❄️ 진행 중인 FREEZE</div>
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
                <div class="dday-stat-label" data-i18n="investAmount">FREEZE 금액</div>
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
          <div class="page-title" data-i18n="pageInvest">❄️ FREEZE</div>

          <!-- 투자 현황 요약 -->
          <div class="invest-summary">
            <div class="invest-sum-item">
              <div class="invest-sum-label" data-i18n="activeInvest">활성 FREEZE</div>
              <div class="invest-sum-value" id="activeInvestCount">0건</div>
            </div>
            <div class="invest-sum-item">
              <div class="invest-sum-label" data-i18n="totalInvest">전체 FREEZE</div>
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
              <i class="fas fa-calculator"></i> <span data-i18n="simTitle">❄️ FREEZE 시뮬레이터</span>
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
                <span class="sim-label" data-i18n="simInvestAmount">FREEZE 금액</span>
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
            <span class="section-title" data-i18n="productListTitle">❄️ FREEZE 플랜</span>
          </div>
          <div id="productList" class="product-list">
            <div class="skeleton-item tall"></div>
            <div class="skeleton-item tall"></div>
          </div>

          <!-- 내 FREEZE 현황 -->
          <div class="section-header mt-16">
            <span class="section-title" data-i18n="myInvestTitle">📋 내 FREEZE 현황</span>
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

          <!-- 게임 헤더 배너 -->
          <div class="game-header-banner">
            <div class="game-header-left">
              <div class="game-header-title">🎮 DDRA Casino</div>
              <div class="game-header-sub">수익으로 즉시 플레이</div>
            </div>
            <div class="game-balance-pill">
              <span class="gbp-icon">💎</span>
              <div>
                <div class="gbp-val" id="gameBalance">0.00</div>
                <div class="gbp-sub" id="gameBalanceUsd">≈ $0.00</div>
              </div>
              <span class="gbp-unit">DDRA</span>
            </div>
          </div>

          <!-- 게임 로비 그리드 -->
          <div class="game-grid-v2">

            <div class="game-card-v2" onclick="startGame('oddeven')">
              <div class="gcv2-badge live">LIVE</div>
              <div class="gcv2-icon">🪙</div>
              <div class="gcv2-name">홀짝</div>
              <div class="gcv2-desc">50% 확률 · 2배</div>
              <div class="gcv2-rtp">RTP 96%</div>
            </div>

            <div class="game-card-v2" onclick="startGame('dice')">
              <div class="gcv2-badge hot">HOT</div>
              <div class="gcv2-icon">🎲</div>
              <div class="gcv2-name">주사위</div>
              <div class="gcv2-desc">숫자 맞추기 · 6배</div>
              <div class="gcv2-rtp">RTP 94%</div>
            </div>

            <div class="game-card-v2" onclick="startGame('slot')">
              <div class="gcv2-badge jackpot">JACKPOT</div>
              <div class="gcv2-icon">🎰</div>
              <div class="gcv2-name">슬롯머신</div>
              <div class="gcv2-desc">잭팟 최대 50배</div>
              <div class="gcv2-rtp">RTP 92%</div>
            </div>

            <div class="game-card-v2" onclick="startGame('baccarat')">
              <div class="gcv2-badge hot">HOT</div>
              <div class="gcv2-icon">🃏</div>
              <div class="gcv2-name">바카라</div>
              <div class="gcv2-desc">뱅커/플레이어 · 1.95배</div>
              <div class="gcv2-rtp">RTP 98.9%</div>
            </div>

            <div class="game-card-v2" onclick="startGame('roulette')">
              <div class="gcv2-badge new-badge">NEW</div>
              <div class="gcv2-icon">🎡</div>
              <div class="gcv2-name">룰렛</div>
              <div class="gcv2-desc">숫자/색상 베팅 · 35배</div>
              <div class="gcv2-rtp">RTP 97.3%</div>
            </div>

            <div class="game-card-v2" onclick="startGame('poker')">
              <div class="gcv2-badge new-badge">NEW</div>
              <div class="gcv2-icon">♠️</div>
              <div class="gcv2-name">포커</div>
              <div class="gcv2-desc">텍사스 홀덤 · 100배</div>
              <div class="gcv2-rtp">RTP 99%</div>
            </div>

          </div>

          <!-- ===== 홀짝 게임 ===== -->
          <div id="gameOddEven" class="game-area-v2 hidden">
            <div class="gav2-header">
              <div class="gav2-title-wrap">
                <span class="gav2-icon">🪙</span>
                <span class="gav2-title">홀짝 게임</span>
              </div>
              <button onclick="closeGame()" class="gav2-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="gav2-body">
              <div class="gav2-bet-row">
                <span class="gav2-bet-label">베팅</span>
                <div class="gav2-bet-val"><span id="oeCurrentBet">10</span> DDRA <small id="oeBetUsdt">≈$5.00</small></div>
              </div>
              <div class="bet-slider-wrap">
                <input type="range" class="bet-slider-v2" id="oeBetSlider" min="1" max="1000" value="10" oninput="updateBetDisplay('oe', this.value)" />
              </div>
              <div class="bet-chip-row">
                <button class="bet-chip" onclick="setBetAmount('oe',10)">10</button>
                <button class="bet-chip" onclick="setBetAmount('oe',50)">50</button>
                <button class="bet-chip" onclick="setBetAmount('oe',100)">100</button>
                <button class="bet-chip" onclick="setBetAmount('oe',500)">500</button>
                <button class="bet-chip half" onclick="setBetGameHalf('oe')">½ MAX</button>
              </div>

              <!-- 코인 애니메이션 -->
              <div class="coin-stage">
                <div class="coin-3d" id="coinFlip">
                  <div class="coin-side heads">
                    <div class="coin-face-inner">홀</div>
                  </div>
                  <div class="coin-side tails">
                    <div class="coin-face-inner">짝</div>
                  </div>
                </div>
                <div class="coin-shadow" id="coinShadow"></div>
                <div class="coin-hint" id="coinResultText">홀 또는 짝을 선택하세요</div>
              </div>

              <div class="oe-choice-row">
                <button class="oe-btn odd-btn" id="oeBtnOdd" onclick="playOddEven('odd')">
                  <span class="oe-num">1 3 5</span>
                  <span class="oe-name">홀 (Odd)</span>
                  <span class="oe-odds">× 2배</span>
                </button>
                <button class="oe-btn even-btn" id="oeBtnEven" onclick="playOddEven('even')">
                  <span class="oe-num">2 4 6</span>
                  <span class="oe-name">짝 (Even)</span>
                  <span class="oe-odds">× 2배</span>
                </button>
              </div>
              <div id="oeResult" class="game-result-v2 hidden"></div>
            </div>
          </div>

          <!-- ===== 주사위 게임 ===== -->
          <div id="gameDice" class="game-area-v2 hidden">
            <div class="gav2-header">
              <div class="gav2-title-wrap">
                <span class="gav2-icon">🎲</span>
                <span class="gav2-title">주사위 게임</span>
              </div>
              <button onclick="closeGame()" class="gav2-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="gav2-body">
              <div class="gav2-bet-row">
                <span class="gav2-bet-label">베팅</span>
                <div class="gav2-bet-val"><span id="diceCurrentBet">10</span> DDRA <small id="diceBetUsdt">≈$5.00</small></div>
              </div>
              <div class="bet-chip-row">
                <button class="bet-chip" onclick="setBetAmount('dice',10)">10</button>
                <button class="bet-chip" onclick="setBetAmount('dice',50)">50</button>
                <button class="bet-chip" onclick="setBetAmount('dice',100)">100</button>
                <button class="bet-chip" onclick="setBetAmount('dice',500)">500</button>
                <button class="bet-chip half" onclick="setBetGameHalf('dice')">½ MAX</button>
              </div>

              <!-- 3D 주사위 -->
              <div class="dice-stage">
                <div class="dice-glow"></div>
                <div class="dice-3d-v2" id="dice3d">
                  <div class="dice-face-v2" id="diceDots"></div>
                </div>
              </div>
              <div class="dice-hint">숫자를 선택하여 베팅하세요</div>
              <div class="dice-btn-grid">
                ${[1,2,3,4,5,6].map(n => `<button class="dice-num-v2" onclick="playDice(${n})"><span class="dice-num-inner">${n}</span></button>`).join('')}
              </div>
              <div id="diceResult" class="game-result-v2 hidden"></div>
            </div>
          </div>

          <!-- ===== 슬롯 게임 ===== -->
          <div id="gameSlot" class="game-area-v2 hidden">
            <div class="gav2-header">
              <div class="gav2-title-wrap">
                <span class="gav2-icon">🎰</span>
                <span class="gav2-title">슬롯머신</span>
              </div>
              <button onclick="closeGame()" class="gav2-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="gav2-body">
              <div class="gav2-bet-row">
                <span class="gav2-bet-label">베팅</span>
                <div class="gav2-bet-val"><span id="slotCurrentBet">10</span> DDRA <small id="slotBetUsdt">≈$5.00</small></div>
              </div>
              <div class="bet-chip-row">
                <button class="bet-chip" onclick="setBetAmount('slot',10)">10</button>
                <button class="bet-chip" onclick="setBetAmount('slot',50)">50</button>
                <button class="bet-chip" onclick="setBetAmount('slot',100)">100</button>
                <button class="bet-chip" onclick="setBetAmount('slot',500)">500</button>
                <button class="bet-chip half" onclick="setBetGameHalf('slot')">½ MAX</button>
              </div>

              <!-- 슬롯 머신 -->
              <div class="slot-machine-v2">
                <div class="slot-machine-top">
                  <span class="slot-brand">✦ DDRA SLOTS ✦</span>
                </div>
                <div class="slot-screen">
                  <div class="slot-reel-wrap">
                    <div class="slot-reel-track" id="reel1Track">
                      <div class="slot-reel-v2" id="reel1">🍋</div>
                    </div>
                  </div>
                  <div class="slot-divider"></div>
                  <div class="slot-reel-wrap">
                    <div class="slot-reel-track" id="reel2Track">
                      <div class="slot-reel-v2" id="reel2">🍋</div>
                    </div>
                  </div>
                  <div class="slot-divider"></div>
                  <div class="slot-reel-wrap">
                    <div class="slot-reel-track" id="reel3Track">
                      <div class="slot-reel-v2" id="reel3">🍋</div>
                    </div>
                  </div>
                  <div class="slot-win-line"></div>
                </div>
                <div class="slot-paytable-v2">
                  <div class="spt-item jackpot">💎💎💎 <span>×50</span></div>
                  <div class="spt-item gold">7️⃣7️⃣7️⃣ <span>×20</span></div>
                  <div class="spt-item silver">⭐⭐⭐ <span>×10</span></div>
                  <div class="spt-item bronze">같은 3개 <span>×5</span></div>
                </div>
              </div>
              <button class="btn-spin-v2" id="spinBtn" onclick="playSpin()">
                <span id="spinBtnIcon">🎰</span> <span id="spinBtnText">SPIN!</span>
              </button>
              <div id="slotResult" class="game-result-v2 hidden"></div>
            </div>
          </div>

          <!-- ===== 룰렛 게임 ===== -->
          <div id="gameRoulette" class="game-area-v2 hidden">
            <div class="gav2-header">
              <div class="gav2-title-wrap">
                <span class="gav2-icon">🎡</span>
                <span class="gav2-title">룰렛</span>
              </div>
              <button onclick="closeGame()" class="gav2-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="gav2-body roulette-body-v2">
              <div class="gav2-bet-row">
                <span class="gav2-bet-label">베팅</span>
                <div class="gav2-bet-val"><span id="rlCurrentBet">10</span> DDRA <small id="rlBetUsdt">≈$5.00</small></div>
              </div>
              <div class="bet-chip-row">
                <button class="bet-chip" onclick="setBetAmount('rl',10)">10</button>
                <button class="bet-chip" onclick="setBetAmount('rl',50)">50</button>
                <button class="bet-chip" onclick="setBetAmount('rl',100)">100</button>
                <button class="bet-chip" onclick="setBetAmount('rl',500)">500</button>
                <button class="bet-chip half" onclick="setBetGameHalf('rl')">½ MAX</button>
              </div>

              <!-- 룰렛 휠 -->
              <div class="roulette-stage">
                <div class="roulette-wheel-v2">
                  <canvas id="rouletteCanvas" width="280" height="280"></canvas>
                  <div class="roulette-pointer-v2">▼</div>
                  <div class="roulette-center-hub"></div>
                </div>
              </div>

              <!-- 베팅 탭 -->
              <div class="rl-tab-bar">
                <button class="rl-tab-v2 active" onclick="switchRlTab('simple')" id="rlTabSimple">간단 베팅</button>
                <button class="rl-tab-v2" onclick="switchRlTab('number')" id="rlTabNumber">숫자 베팅</button>
              </div>

              <div id="rlPanelSimple" class="rl-panel">
                <div class="rl-simple-v2">
                  <button class="rl-chip-btn rlc-red"    onclick="selectRlBet('red')"    id="rlBtnRed">🔴 레드 ×2</button>
                  <button class="rl-chip-btn rlc-black"  onclick="selectRlBet('black')"  id="rlBtnBlack">⚫ 블랙 ×2</button>
                  <button class="rl-chip-btn rlc-green"  onclick="selectRlBet('zero')"   id="rlBtnZero">🟢 제로 ×35</button>
                  <button class="rl-chip-btn rlc-blue"   onclick="selectRlBet('odd')"    id="rlBtnOdd">홀수 ×2</button>
                  <button class="rl-chip-btn rlc-blue"   onclick="selectRlBet('even')"   id="rlBtnEven">짝수 ×2</button>
                  <button class="rl-chip-btn rlc-orange" onclick="selectRlBet('low')"    id="rlBtnLow">1-18 ×2</button>
                  <button class="rl-chip-btn rlc-orange" onclick="selectRlBet('high')"   id="rlBtnHigh">19-36 ×2</button>
                  <button class="rl-chip-btn rlc-purple" onclick="selectRlBet('dozen1')" id="rlBtnDoz1">1-12 ×3</button>
                  <button class="rl-chip-btn rlc-purple" onclick="selectRlBet('dozen2')" id="rlBtnDoz2">13-24 ×3</button>
                  <button class="rl-chip-btn rlc-purple" onclick="selectRlBet('dozen3')" id="rlBtnDoz3">25-36 ×3</button>
                </div>
              </div>

              <div id="rlPanelNumber" class="rl-panel hidden">
                <div class="rl-number-board-v2">
                  <button class="rl-num-v2 rn-zero" onclick="selectRlBet('num0')" id="rlNum0">0</button>
                  <div class="rl-num-grid-v2">
                    ${Array.from({length:36},(_,i)=>{
                      const n=i+1;
                      const reds=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                      const cls=reds.includes(n)?'rn-red':'rn-black';
                      return `<button class="rl-num-v2 ${cls}" onclick="selectRlBet('num${n}')" id="rlNum${n}">${n}</button>`;
                    }).join('')}
                  </div>
                </div>
              </div>

              <div class="rl-selected-v2" id="rlSelectedBet">
                <span>선택:</span>
                <span class="rl-sel-val" id="rlSelValue">없음</span>
              </div>

              <button class="btn-spin-v2 roulette-spin-v2" onclick="playRoulette()" id="rlSpinBtn">
                <span id="rlSpinBtnIcon">🎡</span> SPIN!
              </button>
              <div id="rouletteResult" class="game-result-v2 hidden"></div>
            </div>
          </div>

          <!-- ===== 바카라 게임 ===== -->
          <div id="gameBaccarat" class="game-area-v2 hidden">
            <div class="gav2-header">
              <div class="gav2-title-wrap">
                <span class="gav2-icon">🃏</span>
                <span class="gav2-title">바카라</span>
              </div>
              <button onclick="closeGame()" class="gav2-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="gav2-body">
              <div class="gav2-bet-row">
                <span class="gav2-bet-label">베팅</span>
                <div class="gav2-bet-val"><span id="bacCurrentBet">10</span> DDRA <small id="bacBetUsdt">≈$5.00</small></div>
              </div>
              <div class="bet-chip-row">
                <button class="bet-chip" onclick="setBetAmount('bac',10)">10</button>
                <button class="bet-chip" onclick="setBetAmount('bac',50)">50</button>
                <button class="bet-chip" onclick="setBetAmount('bac',100)">100</button>
                <button class="bet-chip" onclick="setBetAmount('bac',500)">500</button>
                <button class="bet-chip half" onclick="setBetGameHalf('bac')">½ MAX</button>
              </div>

              <!-- 바카라 그린 테이블 -->
              <div class="bac-felt-table">
                <div class="bac-felt-side player-felt">
                  <div class="bac-felt-label">👤 플레이어</div>
                  <div class="bac-felt-cards" id="bacPlayerCards"></div>
                  <div class="bac-felt-score" id="bacPlayerScore">-</div>
                  <div class="bac-felt-odds">× 2배</div>
                </div>
                <div class="bac-felt-center">
                  <div class="bac-felt-vs">VS</div>
                  <div class="bac-tie-box">
                    <div class="bac-tie-txt">🤝 타이</div>
                    <div class="bac-tie-odd">× 8배</div>
                  </div>
                </div>
                <div class="bac-felt-side banker-felt">
                  <div class="bac-felt-label">🏦 뱅커</div>
                  <div class="bac-felt-cards" id="bacBankerCards"></div>
                  <div class="bac-felt-score" id="bacBankerScore">-</div>
                  <div class="bac-felt-odds">× 1.95배</div>
                </div>
              </div>

              <div class="bac-action-row">
                <button class="bac-action-btn bab-player" id="bacBtnPlayer" onclick="playBaccarat('player')">
                  <span>👤</span> 플레이어
                </button>
                <button class="bac-action-btn bab-tie" id="bacBtnTie" onclick="playBaccarat('tie')">
                  <span>🤝</span> 타이
                </button>
                <button class="bac-action-btn bab-banker" id="bacBtnBanker" onclick="playBaccarat('banker')">
                  <span>🏦</span> 뱅커
                </button>
              </div>
              <div id="bacResult" class="game-result-v2 hidden"></div>
            </div>
          </div>

          <!-- ===== 포커 게임 ===== -->
          <div id="gamePoker" class="game-area-v2 hidden">
            <div class="gav2-header">
              <div class="gav2-title-wrap">
                <span class="gav2-icon">♠️</span>
                <span class="gav2-title">텍사스 홀덤</span>
              </div>
              <button onclick="closeGame()" class="gav2-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="gav2-body">
              <div class="gav2-bet-row">
                <span class="gav2-bet-label">앤티 베팅</span>
                <div class="gav2-bet-val"><span id="pkCurrentBet">10</span> DDRA <small id="pkBetUsdt">≈$5.00</small></div>
              </div>
              <div class="bet-chip-row">
                <button class="bet-chip" onclick="setBetAmount('pk',10)">10</button>
                <button class="bet-chip" onclick="setBetAmount('pk',50)">50</button>
                <button class="bet-chip" onclick="setBetAmount('pk',100)">100</button>
                <button class="bet-chip" onclick="setBetAmount('pk',500)">500</button>
                <button class="bet-chip half" onclick="setBetGameHalf('pk')">½ MAX</button>
              </div>

              <!-- 포커 테이블 -->
              <div class="poker-table-v2">
                <div class="poker-community-v2">
                  <div class="poker-section-label">🎴 보드 (커뮤니티)</div>
                  <div class="poker-cards-v2" id="pkCommunityCards">
                    <div class="card-placeholder"></div>
                    <div class="card-placeholder"></div>
                    <div class="card-placeholder"></div>
                    <div class="card-placeholder"></div>
                    <div class="card-placeholder"></div>
                  </div>
                </div>
                <div class="poker-hands-v2">
                  <div class="poker-hand-v2">
                    <div class="poker-section-label">🤖 딜러 핸드</div>
                    <div class="poker-cards-v2" id="pkDealerCards">
                      <div class="card-placeholder"></div>
                      <div class="card-placeholder"></div>
                    </div>
                    <div class="poker-hand-rank" id="pkDealerHand">-</div>
                  </div>
                  <div class="poker-hand-v2">
                    <div class="poker-section-label">👤 내 핸드</div>
                    <div class="poker-cards-v2" id="pkPlayerCards">
                      <div class="card-placeholder"></div>
                      <div class="card-placeholder"></div>
                    </div>
                    <div class="poker-hand-rank player-rank" id="pkPlayerHand">-</div>
                  </div>
                </div>
                <div class="poker-paytable-v2">
                  <div class="ppt-title">🏆 페이테이블</div>
                  <div class="ppt-grid">
                    <div class="ppt-row jackpot"><span>로열 플러시</span><span>×100</span></div>
                    <div class="ppt-row gold"><span>스트레이트 플러시</span><span>×50</span></div>
                    <div class="ppt-row gold"><span>포카드</span><span>×25</span></div>
                    <div class="ppt-row silver"><span>풀 하우스</span><span>×9</span></div>
                    <div class="ppt-row silver"><span>플러시</span><span>×6</span></div>
                    <div class="ppt-row bronze"><span>스트레이트</span><span>×4</span></div>
                    <div class="ppt-row bronze"><span>쓰리 오브 어 카인드</span><span>×3</span></div>
                    <div class="ppt-row"><span>투 페어</span><span>×2</span></div>
                    <div class="ppt-row"><span>원 페어</span><span>×1.5</span></div>
                    <div class="ppt-row lose"><span>하이카드</span><span>패배</span></div>
                  </div>
                </div>
              </div>

              <button class="btn-deal-v2" id="pkDealBtn" onclick="dealPoker()">
                ♠️ 딜 (카드 받기)
              </button>
              <div id="pkResult" class="game-result-v2 hidden"></div>
            </div>
          </div>

          <!-- 게임 기록 -->
          <div class="section-header mt-16">
            <span class="section-title">📋 최근 게임 기록</span>
          </div>
          <div id="gameLogList" class="tx-list">
            <div class="empty-state">
              <i class="fas fa-gamepad"></i>
              <span>게임을 시작해보세요!</span>
            </div>
          </div>

        </div>
      </div>

      <!-- ======== MORE 페이지 ======== -->
      <div id="morePage" class="page">
        <div class="page-scroll">

          <!-- 거래 내역 (상단) -->
          <div class="menu-section" style="margin-top:0;padding-top:16px;">
            <div class="menu-section-title large" data-i18n="txHistory">📊 거래 내역</div>
            <div class="tx-tabs">
              <button class="tx-tab active" onclick="switchTxTab('all', this)" data-i18n="txAll">전체</button>
              <button class="tx-tab" onclick="switchTxTab('deposit', this)" data-i18n="txDeposit">입금</button>
              <button class="tx-tab" onclick="switchTxTab('withdrawal', this)" data-i18n="txWithdraw">출금</button>
              <button class="tx-tab" onclick="switchTxTab('invest', this)" data-i18n="txInvest">FREEZE</button>
              <button class="tx-tab" onclick="switchTxTab('roi', this)">ROI 수익</button>
            </div>
            <div id="txHistoryList" class="tx-list">
              <div class="skeleton-item"></div>
              <div class="skeleton-item"></div>
            </div>
          </div>

          <!-- 프로필 카드 -->
          <div class="profile-card" style="margin-top:8px;">
            <div class="profile-avatar">👤</div>
            <div class="profile-info">
              <div class="profile-name" id="profileName">-</div>
              <div class="profile-email" id="profileEmail">-</div>
              <div class="profile-rank-badge" id="profileRank">
                <i class="fas fa-star" style="font-size:10px"></i> G0
              </div>
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
        <span>FREEZE</span>
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

<!-- 수익 출금 모달 (DDRA 지급) -->
<div id="withdrawModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('withdrawModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalWithdraw">💸 DDRA 출금 신청</div>
    <div class="modal-body">
      <!-- 출금 가능 DDRA -->
      <div class="info-box" style="margin-bottom:14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:14px;padding:14px 16px;">
        <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">출금 가능 DDRA (수익)</div>
        <div style="font-size:26px;font-weight:800;color:#f59e0b;letter-spacing:-0.5px;">
          <span id="withdrawAvailable">0.00</span> DDRA
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;" id="withdrawAvailableUsdt">≈ $0.00 USDT</div>
      </div>
      <!-- 원금 잠금 안내 -->
      <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--text2);">
        🔒 <strong style="color:#818cf8">FREEZE 원금</strong>은 만기까지 잠금·&nbsp;
        <strong style="color:#f59e0b">수익(ROI·보너스)</strong>은 언제든지 출금 가능
      </div>
      <div class="form-group">
        <label class="form-label">출금 수량 (DDRA)</label>
        <input type="number" id="withdrawAmount" class="form-input" placeholder="0.00" min="0" step="1"
          oninput="onWithdrawAmountInput()" />
        <!-- USDT 환산 실시간 표시 -->
        <div id="withdrawDdraCalc" style="margin-top:6px;font-size:12px;color:#94a3b8;padding:6px 10px;background:var(--card2,rgba(255,255,255,0.04));border-radius:8px;">
          1 DDRA = $0.5000 USDT
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="withdrawAddressLabel">수신 지갑 주소 (DDRA)</label>
        <input type="text" id="withdrawAddress" class="form-input" placeholder="DDRA 수신 지갑 주소 입력" />
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

<!-- FREEZE 신청 모달 -->
<div id="investModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('investModal')"></div>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title" data-i18n="modalInvest">❄️ FREEZE 신청</div>
    <div class="modal-body">
      <div class="invest-product-summary" id="investProductSummary"></div>
      <div class="form-group">
        <label class="form-label" data-i18n="investAmountLabel">FREEZE 금액 (USDT)</label>
        <input type="number" id="investAmount" class="form-input" placeholder="0.00" oninput="updateInvestPreview()" />
        <div class="input-hint" id="investAmountHint"></div>
      </div>
      <div class="invest-preview" id="investPreview" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('investModal')" style="flex:1" data-i18n="btnCancel">취소</button>
      <button class="btn btn-primary" onclick="submitInvest()" style="flex:2" data-i18n="btnSubmitInvest">FREEZE 신청</button>
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
      <div class="form-group">
        <label class="form-label" data-i18n="labelCountry">국가</label>
        <select id="editCountry" class="form-input" style="appearance:none;-webkit-appearance:none;cursor:pointer;">
          <option value="">-- 국가 선택 --</option>
          <option value="KR">🇰🇷 대한민국</option>
          <option value="US">🇺🇸 미국</option>
          <option value="JP">🇯🇵 일본</option>
          <option value="CN">🇨🇳 중국</option>
          <option value="VN">🇻🇳 베트남</option>
          <option value="TH">🇹🇭 태국</option>
          <option value="PH">🇵🇭 필리핀</option>
          <option value="ID">🇮🇩 인도네시아</option>
          <option value="MY">🇲🇾 말레이시아</option>
          <option value="SG">🇸🇬 싱가포르</option>
          <option value="AU">🇦🇺 호주</option>
          <option value="GB">🇬🇧 영국</option>
          <option value="DE">🇩🇪 독일</option>
          <option value="FR">🇫🇷 프랑스</option>
          <option value="CA">🇨🇦 캐나다</option>
          <option value="IN">🇮🇳 인도</option>
          <option value="BR">🇧🇷 브라질</option>
          <option value="RU">🇷🇺 러시아</option>
          <option value="UAE">🇦🇪 UAE</option>
          <option value="OTHER">🌐 기타</option>
        </select>
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

<!-- 알림 모달 -->
<div id="notiModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('notiModal')"></div>
  <div class="modal-sheet large">
    <div class="modal-handle"></div>
    <div class="modal-title">🔔 알림 센터</div>
    <div class="modal-body">
      <div id="notiList" class="noti-list"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost btn-full" onclick="closeModal('notiModal')" data-i18n="btnClose">닫기</button>
    </div>
  </div>
</div>

<!-- 공지사항 상세 모달 -->
<div id="announcementDetailModal" class="modal hidden">
  <div class="modal-overlay" onclick="closeModal('announcementDetailModal')"></div>
  <div class="modal-sheet large">
    <div class="modal-handle"></div>
    <div class="modal-title" id="annDetailTitle">📢 공지사항</div>
    <div class="modal-body">
      <div id="annDetailDate" style="font-size:12px;color:var(--text2);margin-bottom:12px;"></div>
      <div id="annDetailBody"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost btn-full" onclick="closeModal('announcementDetailModal')" data-i18n="btnClose">닫기</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast" class="toast"></div>

<!-- Confirm Dialog Modal -->
<div id="confirmModal" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;">
  <div style="background:#1e293b;border-radius:18px;padding:28px 24px 20px;width:88%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);text-align:center;">
    <div id="confirmModalIcon" style="font-size:36px;margin-bottom:12px;">⚠️</div>
    <div id="confirmModalMsg" style="color:#f1f5f9;font-size:15px;font-weight:600;margin-bottom:20px;line-height:1.5;"></div>
    <div style="display:flex;gap:10px;">
      <button id="confirmModalCancel" style="flex:1;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#94a3b8;font-size:14px;font-weight:600;cursor:pointer;">취소</button>
      <button id="confirmModalOk" style="flex:1;padding:11px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">확인</button>
    </div>
  </div>
</div>

<!-- Firebase SDK -->
<script type="module" src="/static/firebase.js?v=${Date.now()}"></script>
<script src="/static/app.js?v=${Date.now()}"></script>
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
  <p>Firebase Firestore에 FREEZE 플랜, 테스트 계정, 앱 설정값을 일괄 생성합니다.</p>

  <div class="section">
    <div class="section-title">❌️ 생성될 FREEZE 플랜</div>
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

  <div class="section" style="margin-top:16px;background:#1e293b;border-radius:10px;padding:16px;">
    <div class="section-title" style="color:#f59e0b">🔐 관리자 계정 생성</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
      <input id="adminEmail" type="email" placeholder="관리자 이메일" value="admin@deedra.com"
        style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;flex:1;min-width:200px;"/>
      <input id="adminPass" type="password" placeholder="비밀번호" value="Admin1234!"
        style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;flex:1;min-width:160px;"/>
      <input id="adminName" type="text" placeholder="이름" value="관리자"
        style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;flex:1;min-width:120px;"/>
    </div>
    <button id="btnAdmin"
      style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;padding:10px 22px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">
      🔐 관리자 계정 생성
    </button>
  </div>

  <div class="btn-row">
    <button class="btn-all" id="btnAll" onclick="runAll()">🚀 전체 초기화 (상품 + 계정 + 설정)</button>
    <button class="btn-products" id="btnProducts" onclick="createProducts()">❌️ FREEZE 플랜만 생성</button>
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

async function createAdmin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value.trim();
  const name  = document.getElementById('adminName').value.trim() || '관리자';
  if (!email || !pass) { log('❌ 이메일과 비밀번호를 입력해주세요.', '#fca5a5'); return; }
  const btn = document.getElementById('btnAdmin');
  btn.disabled = true;
  log('\\n🔐 [관리자 계정 생성 시작]', '#fcd34d');
  log('  이메일: ' + email, '#e5e7eb');
  try {
    let uid;
    try {
      const c = await createUserWithEmailAndPassword(auth, email, pass);
      uid = c.user.uid;
      log('  ✅ Firebase Auth 계정 생성 완료', '#86efac');
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') {
        const c = await signInWithEmailAndPassword(auth, email, pass);
        uid = c.user.uid;
        log('  ℹ️ 기존 계정 발견 → role을 admin으로 업데이트', '#93c5fd');
      } else throw e;
    }
    await setDoc(doc(db, 'users', uid), {
      uid, email, name, role: 'admin',
      status: 'active', rank: 'ADMIN',
      referralCode: 'ADMIN', referredBy: null,
      phone: '', createdAt: serverTimestamp()
    }, { merge: true });
    log('  ✅ Firestore users 저장 완료 (role: admin)', '#86efac');
    log('\\n✅✅ 관리자 계정 생성 완료!', '#fcd34d');
    log('  📧 이메일: ' + email, '#fcd34d');
    log('  🔑 비밀번호: ' + pass, '#fcd34d');
    log('  👉 /admin 에서 로그인하세요', '#fcd34d');
  } catch(e) {
    log('  ❌ 오류: ' + e.message, '#fca5a5');
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('btnAdmin').addEventListener('click', createAdmin);

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
      content: 'DEEDRA FREEZE 서비스가 새로운 디자인으로 리뉴얼되었습니다. 더 편리해진 UI로 FREEZE를 시작해보세요!',
      isActive: true,
      isPinned: true,
      createdAt: serverTimestamp()
    });
    await addDoc(collection(db, 'announcements'), {
      title: '💸 FREEZE 플랜 안내',
      content: 'Basic(0.4%/30일), Standard(0.5%/90일), Premium(0.6%/180일), VIP(0.8%/360일) FREEZE 플랜이 출시되었습니다.',
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
