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

// ─── 실시간 환율 API (/api/price/forex) ──────────────────────────────────────
// ExchangeRate-API 무료 플랜 사용 (API 키 불필요, USD 기준 최신 환율)
// 지원 통화: KRW(한국), THB(태국), VND(베트남), USD, 기타
// 응답 캐싱: 1시간 (Cloudflare edge cache)
let _forexCache: { rates: Record<string, number>; ts: number } | null = null

app.get('/api/price/forex', async (c) => {
  try {
    const now = Date.now()
    // 메모리 캐시 1시간
    if (_forexCache && now - _forexCache.ts < 3600_000) {
      return c.json({ success: true, rates: _forexCache.rates, cached: true, updatedAt: _forexCache.ts })
    }
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: any = await res.json()
    if (data.result !== 'success') throw new Error('API error')
    const rates: Record<string, number> = {
      KRW: data.rates.KRW,
      THB: data.rates.THB,
      VND: data.rates.VND,
      USD: 1,
      CNY: data.rates.CNY,
      JPY: data.rates.JPY,
      SGD: data.rates.SGD,
      MYR: data.rates.MYR,
      IDR: data.rates.IDR,
      PHP: data.rates.PHP,
    }
    _forexCache = { rates, ts: now }
    return c.json({ success: true, rates, cached: false, updatedAt: now })
  } catch (e: any) {
    // 캐시가 있으면 만료돼도 반환
    if (_forexCache) {
      return c.json({ success: true, rates: _forexCache.rates, cached: true, updatedAt: _forexCache.ts })
    }
    // 폴백: 하드코딩된 기본값 반환
    return c.json({
      success: true,
      rates: { KRW: 1380, THB: 34, VND: 26000, USD: 1, CNY: 7.2, JPY: 155, SGD: 1.35, MYR: 4.7, IDR: 16300, PHP: 58 },
      cached: false, fallback: true, updatedAt: Date.now()
    })
  }
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
        <form id="loginForm" onsubmit="event.preventDefault();handleLogin()" autocomplete="on">
          <div class="form-group">
            <label class="form-label" data-i18n="labelEmail">이메일</label>
            <input type="email" id="loginEmail" name="email" class="form-input" placeholder="이메일을 입력하세요" autocomplete="username" data-i18n="placeholderEmail" data-i18n-attr="placeholder" />
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="labelPassword">비밀번호</label>
            <input type="password" id="loginPassword" name="password" class="form-input" placeholder="비밀번호를 입력하세요" autocomplete="current-password" data-i18n="placeholderPassword" data-i18n-attr="placeholder" />
          </div>
          <button type="submit" class="btn btn-primary btn-full mt-8">
            <i class="fas fa-sign-in-alt"></i> <span data-i18n="btnLogin">로그인</span>
          </button>
          <button type="button" class="btn btn-ghost btn-full mt-8" onclick="handleForgotPassword()" style="font-size:14px" data-i18n="forgotPassword">
            비밀번호를 잊으셨나요?
          </button>
        </form>

        <!-- 회원가입 폼 -->
        <form id="registerForm" class="hidden" onsubmit="event.preventDefault();handleRegister()" autocomplete="on">
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
            <input type="password" id="regPassword" class="form-input" placeholder="6자리 이상 입력하세요" data-i18n="placeholderPasswordMin" data-i18n-attr="placeholder" />
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
          <button type="submit" class="btn btn-primary btn-full mt-8">
            <i class="fas fa-user-plus"></i> <span data-i18n="btnRegister">회원가입</span>
          </button>
        </form>
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
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div class="asset-total-label" data-i18n="totalAssetLabel">총 자산 (USDT 환산)</div>
              <img src="/static/img/usdt-coin.png" alt="USDT"
                style="width:44px;height:44px;border-radius:50%;object-fit:cover;
                       box-shadow:0 2px 10px rgba(0,0,0,0.3);flex-shrink:0;" />
            </div>
            <div class="asset-total-amount" id="totalAsset">0.00 USDT</div>
            <div class="asset-total-sub" id="totalAssetKrw">≈ ₩0</div>
            <div id="forexRateInfo" style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:2px;"></div>

            <!-- 원금 / 수익(출금가능DDRA) 2분할 -->
            <div class="asset-split-row">
              <div class="asset-split-item">
                <div class="asset-split-icon">🔒</div>
                <div class="asset-split-label" data-i18n="assetLocked">USDT 원금</div>
                <div class="asset-split-value" id="splitUsdt">0.00 USDT</div>
                <div class="asset-split-sub" style="color:#94a3b8;font-size:11px;" data-i18n="freezingNow">FREEZE 중</div>
              </div>
              <div class="asset-split-item" style="border-left:1px solid rgba(255,255,255,0.08);">
                <img src="/static/img/ddra-coin.png" alt="DDRA"
                  style="width:30px;height:30px;border-radius:50%;object-fit:cover;
                         box-shadow:0 2px 8px rgba(0,0,0,0.35);margin-bottom:4px;" />
                <div class="asset-split-label" style="color:#f59e0b;font-weight:600;" data-i18n="withdrawableDdra">출금 가능 DDRA</div>
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
              <div class="split-label" data-i18n="ddraLivePrice">💎 DDRA 현재 시세</div>
              <div class="split-price" id="deedraPrice">$0.50</div>
              <div class="split-price-sub" id="deedraChange">1 DDRA = $0.5000</div>
              <div class="split-price-updated" id="deedraUpdated"></div>
            </div>
            <!-- 오른쪽: EARN 상품 -->
            <div class="split-right">
              <div class="split-earn-header">
                <span class="split-earn-title">EARN</span>
                <button class="split-earn-more" onclick="switchPage('invest')" data-i18n="earnSeeAll">전체보기 ›</button>
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
            <button class="see-all-btn" onclick="showNetworkEarningsPanel('tx')" data-i18n="seeAll">전체보기</button>
          </div>
          <div id="recentTxList" class="tx-list" onclick="showNetworkEarningsPanel('tx')" style="cursor:pointer;">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
          </div>

          <!-- 네트워크 수익 미리보기 -->
          <div class="section-header" style="margin-top:8px;">
            <span class="section-title" data-i18n="networkEarnings">🌐 네트워크 수익</span>
            <button class="see-all-btn" onclick="showNetworkEarningsPanel('gen1')" data-i18n="networkDetail">자세히 보기</button>
          </div>
          <div onclick="showNetworkEarningsPanel('gen1')" style="cursor:pointer;
            background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08));
            border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:14px 16px;
            display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;
          ">
            <div style="display:flex;gap:20px;">
              <div style="text-align:center;">
                <div style="font-size:10px;color:var(--text2,#94a3b8);margin-bottom:3px;" data-i18n="todayEarn">당일 수익</div>
                <div id="homeNetTodayEarn" style="font-size:15px;font-weight:700;color:#10b981;">$0.00</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:10px;color:var(--text2,#94a3b8);margin-bottom:3px;" data-i18n="subMembers">하부 인원</div>
                <div id="homeNetMembers" style="font-size:15px;font-weight:700;color:#3b82f6;">0명</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:10px;color:var(--text2,#94a3b8);margin-bottom:3px;" data-i18n="totalEarnings">누적 수익</div>
                <div id="homeNetTotalEarn" style="font-size:15px;font-weight:700;color:#8b5cf6;">$0.00</div>
              </div>
            </div>
            <div style="color:var(--text2,#94a3b8);font-size:18px;">›</div>
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
    <div class="modal-title">💰 USDT 입금</div>
    <div class="modal-body" style="padding-bottom:8px;">

      <!-- ── 탭 전환: 지갑연동 / 수동입금 ── -->
      <div style="display:flex;background:#f1f5f9;border-radius:10px;padding:3px;margin-bottom:18px;gap:3px;">
        <button id="depTabWallet" onclick="switchDepTab('wallet')"
          style="flex:1;padding:8px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;transition:.2s;">
          🔗 지갑 연동
        </button>
        <button id="depTabManual" onclick="switchDepTab('manual')"
          style="flex:1;padding:8px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:transparent;color:#64748b;transition:.2s;">
          ✏️ 수동 입금
        </button>
      </div>

      <!-- ══ 지갑 연동 탭 ══ -->
      <div id="depPanelWallet">

        <!-- 지갑 연결 전 -->
        <div id="depWalletConnect">
          <div style="text-align:center;padding:8px 0 20px;">
            <div style="font-size:42px;margin-bottom:10px;">👛</div>
            <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:6px;">지갑을 연결하세요</div>
            <div style="font-size:12px;color:#64748b;margin-bottom:20px;">Phantom, TokenPocket 등 Solana 지갑을 지원합니다</div>
            <div style="display:flex;flex-direction:column;gap:10px;max-width:280px;margin:0 auto;">
              <button onclick="connectSolanaWallet()" id="btnConnectWallet"
                style="padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">
                <span style="font-size:20px;">👻</span> Phantom / 지갑 연결
              </button>
              <div style="font-size:11px;color:#94a3b8;">지갑이 없으신가요?
                <a href="https://phantom.app" target="_blank" style="color:#6366f1;">Phantom 설치</a> |
                <a href="https://tokenpocket.pro" target="_blank" style="color:#6366f1;">TokenPocket 설치</a>
              </div>
            </div>
          </div>
        </div>

        <!-- 지갑 연결 후 -->
        <div id="depWalletConnected" style="display:none;">
          <!-- 연결된 지갑 정보 -->
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:22px;">✅</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;color:#16a34a;font-weight:700;" id="depWalletName">Phantom</div>
              <div style="font-size:12px;color:#374151;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" id="depWalletAddr">-</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;color:#64748b;">USDT 잔액</div>
              <div style="font-size:14px;font-weight:700;color:#059669;" id="depWalletBalance">조회중...</div>
            </div>
            <button onclick="disconnectSolanaWallet()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:4px;">✕</button>
          </div>

          <!-- 금액 입력 -->
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">입금 금액 (USDT)</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="number" id="depWalletAmount" class="form-input" placeholder="0.00" min="1" step="0.01"
                style="flex:1;" oninput="updateDepWalletFee(this.value)">
            </div>
            <!-- 빠른 선택 -->
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button onclick="setDepAmount(50)"  style="flex:1;padding:6px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;cursor:pointer;">$50</button>
              <button onclick="setDepAmount(100)" style="flex:1;padding:6px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;cursor:pointer;">$100</button>
              <button onclick="setDepAmount(500)" style="flex:1;padding:6px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;cursor:pointer;">$500</button>
              <button onclick="setDepAmount(1000)" style="flex:1;padding:6px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;cursor:pointer;">$1,000</button>
            </div>
          </div>

          <!-- 네트워크 수수료 안내 -->
          <div style="background:#fef9c3;border-radius:8px;padding:10px 12px;font-size:12px;color:#854d0e;margin-bottom:16px;">
            ⚡ <strong>Solana 네트워크</strong> — 가스비 약 $0.001 (SOL)<br>
            <span id="depWalletFeeNote">전송 전 소량의 SOL이 지갑에 있어야 합니다.</span>
          </div>

          <!-- 전송 버튼 -->
          <button onclick="doWalletDeposit()" id="btnWalletSend"
            style="width:100%;padding:15px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:8px;">
            🚀 지갑으로 즉시 전송
          </button>

          <!-- 진행 상태 -->
          <div id="depWalletStatus" style="display:none;text-align:center;padding:12px;border-radius:10px;font-size:13px;font-weight:600;"></div>
        </div>

      </div><!-- /depPanelWallet -->

      <!-- ══ 수동 입금 탭 ══ -->
      <div id="depPanelManual" style="display:none;">
        <div class="info-box">
          <div class="info-label" data-i18n="depositAddrLabel">회사 입금 주소 (Solana USDT)</div>
          <div class="wallet-address-box">
            <span id="companyWalletAddr" data-i18n="depositAddrLoading" style="font-size:12px;">주소 로딩중...</span>
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
          <input type="text" id="depositTxid" class="form-input" placeholder="트랜잭션 해시 입력" />
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="depositMemoLabel">메모 (선택)</label>
          <input type="text" id="depositMemo" class="form-input" placeholder="메모 입력 (선택)" />
        </div>
        <div class="warning-box" data-i18n="depositWarning">⚠️ 반드시 위 주소로 입금 후 TXID를 입력해주세요. 관리자 승인 후 잔액이 업데이트됩니다.</div>
      </div><!-- /depPanelManual -->

    </div><!-- /modal-body -->

    <div class="modal-footer" id="depFooter">
      <button class="btn btn-ghost" onclick="closeModal('depositModal')" style="flex:1">취소</button>
      <!-- 수동 탭일 때만 표시 -->
      <button class="btn btn-primary" id="depManualSubmitBtn" onclick="submitDeposit()" style="flex:2;display:none;">입금 신청</button>
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
        <input type="password" id="withdrawPin" class="form-input" placeholder="●●●●●●" maxlength="6" autocomplete="off" inputmode="numeric" />
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
        <input type="password" id="newPin" class="form-input" placeholder="●●●●●●" maxlength="6" autocomplete="new-password" inputmode="numeric" />
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="confirmPinLabel">PIN 확인</label>
        <input type="password" id="confirmPin" class="form-input" placeholder="●●●●●●" maxlength="6" autocomplete="new-password" inputmode="numeric" />
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
<!-- Solana Web3.js (CDN) — 지갑 연동용 -->
<script src="https://unpkg.com/@solana/web3.js@1.95.4/lib/index.iife.min.js"
  onload="window.solanaWeb3 = solanaWeb3;" onerror="console.warn('Solana Web3.js 로드 실패')"></script>
<!-- Solana 지갑 연동 모듈 -->
<script src="/static/js/solana-wallet.js?v=${Date.now()}"></script>
<script src="/static/app.js?v=${Date.now()}"></script>

<!-- ══════════════════════════════════════════════
     🌐 네트워크 수익 슬라이드업 패널
     ══════════════════════════════════════════════ -->
<div id="networkEarningsPanel" style="
  position:fixed; left:0; right:0; bottom:0; top:0;
  z-index:3000; pointer-events:none;
">
  <!-- 딤 배경 -->
  <div id="nepBackdrop" onclick="closeNetworkEarningsPanel()" style="
    position:absolute; inset:0;
    background:rgba(0,0,0,0.5);
    opacity:0; transition:opacity 0.3s;
    pointer-events:none;
  "></div>

  <!-- 슬라이드업 시트 -->
  <div id="nepSheet" style="
    position:absolute; left:0; right:0; bottom:0;
    max-height:92vh; overflow-y:auto;
    background:var(--bg, #0f172a);
    border-radius:20px 20px 0 0;
    transform:translateY(100%);
    transition:transform 0.35s cubic-bezier(0.32,0.72,0,1);
    pointer-events:auto;
    padding-bottom:env(safe-area-inset-bottom, 16px);
  ">
    <!-- 핸들 -->
    <div style="display:flex;justify-content:center;padding:12px 0 4px;">
      <div style="width:40px;height:4px;background:rgba(255,255,255,0.2);border-radius:99px;"></div>
    </div>

    <!-- 헤더 -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 20px 16px;">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--text,#f1f5f9);">🌐 네트워크 수익</div>
        <div style="font-size:12px;color:var(--text2,#94a3b8);margin-top:2px;" id="nepSubTitle">하부 조직 수익 현황</div>
      </div>
      <button onclick="closeNetworkEarningsPanel()" style="
        background:rgba(255,255,255,0.08);border:none;
        width:32px;height:32px;border-radius:50%;
        color:var(--text,#f1f5f9);font-size:16px;cursor:pointer;
      ">✕</button>
    </div>

    <!-- 요약 카드 3개 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 16px 16px;">
      <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:12px 10px;text-align:center;">
        <div style="font-size:11px;color:#10b981;font-weight:600;margin-bottom:4px;" data-i18n="panelTodayEarn">당일 수익</div>
        <div id="nepTodayEarning" style="font-size:16px;font-weight:700;color:#10b981;">$0.00</div>
      </div>
      <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);border-radius:12px;padding:12px 10px;text-align:center;">
        <div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:4px;" data-i18n="subMembers">총 하부인원</div>
        <div id="nepTotalMembers" style="font-size:16px;font-weight:700;color:#3b82f6;">0</div>
      </div>
      <div style="background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.25);border-radius:12px;padding:12px 10px;text-align:center;">
        <div style="font-size:11px;color:#8b5cf6;font-weight:600;margin-bottom:4px;" data-i18n="panelTotalEarn">총 누적 수익</div>
        <div id="nepTotalEarning" style="font-size:16px;font-weight:700;color:#8b5cf6;">$0.00</div>
      </div>
    </div>

    <!-- 탭: 거래내역 / 1대 / 2대 / 3대+ -->
    <div style="display:flex;gap:0;padding:0 16px 12px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <button class="nep-tab active" data-tab="tx" onclick="switchNepTab('tx')" style="flex:1;padding:8px 4px;background:none;border:none;border-bottom:2px solid #3b82f6;color:#3b82f6;font-size:12px;font-weight:700;cursor:pointer;">💳 거래내역</button>
      <button class="nep-tab" data-tab="gen1" onclick="switchNepTab('gen1')" style="flex:1;padding:8px 4px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text2,#94a3b8);font-size:12px;font-weight:600;cursor:pointer;">👤 1대</button>
      <button class="nep-tab" data-tab="gen2" onclick="switchNepTab('gen2')" style="flex:1;padding:8px 4px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text2,#94a3b8);font-size:12px;font-weight:600;cursor:pointer;">👥 2대</button>
      <button class="nep-tab" data-tab="deep" onclick="switchNepTab('deep')" style="flex:1;padding:8px 4px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text2,#94a3b8);font-size:12px;font-weight:600;cursor:pointer;">🌐 3대+</button>
    </div>

    <!-- 탭 콘텐츠 -->
    <div id="nepContent" style="padding:12px 16px 24px;min-height:200px;">
      <div class="skeleton-item" style="margin-bottom:8px;"></div>
      <div class="skeleton-item" style="margin-bottom:8px;"></div>
      <div class="skeleton-item"></div>
    </div>
  </div>
</div>
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

// ─── Firebase Admin SDK (서비스 계정 내장) ────────────────────────────────────
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  client_id: "103096684164693920388",
  token_uri: "https://oauth2.googleapis.com/token",
  project_id_full: "dedra-mlm"
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`
const CRON_SECRET = 'deedra-cron-2026'

// ─── Firebase Admin JWT 발급 (RS256) ─────────────────────────────────────────
async function getAdminToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase'
  }
  const b64url = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const sigInput = `${b64url(header)}.${b64url(payload)}`

  const pemKey = SERVICE_ACCOUNT.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const jwt = `${sigInput}.${sigB64}`

  const tokenRes = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const tokenData: any = await tokenRes.json()
  return tokenData.access_token
}

// ─── Firestore REST 헬퍼 ─────────────────────────────────────────────────────
async function fsGet(path: string, token: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.ok ? await res.json() : null
}

async function fsQuery(collection: string, token: string, conditions: any[] = [], limit = 100) {
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
    limit
  }
  if (conditions.length > 0) {
    structuredQuery.where = conditions.length === 1 ? conditions[0] : {
      compositeFilter: { op: 'AND', filters: conditions }
    }
  }
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery })
  })
  if (!res.ok) return []
  const rows: any[] = await res.json()
  return rows.filter((r: any) => r.document).map((r: any) => firestoreDocToObj(r.document))
}

async function fsPatch(path: string, fields: any, token: string) {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const res = await fetch(`${FIRESTORE_BASE}/${path}?${updateMask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  return res.ok ? await res.json() : null
}

async function fsCreate(collection: string, data: any, token: string) {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const res = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  return res.ok ? await res.json() : null
}

async function fsSet(path: string, data: any, token: string) {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  return res.ok ? await res.json() : null
}

function toFirestoreValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') {
    const fields: any = {}
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function firestoreDocToObj(doc: any): any {
  const id = doc.name?.split('/').pop()
  const obj: any = { id }
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = fromFirestoreValue(v)
  }
  return obj
}

function fromFirestoreValue(v: any): any {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return parseInt(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue)
  if ('mapValue' in v) {
    const obj: any = {}
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFirestoreValue(val as any)
    return obj
  }
  return null
}

// ─── 텔레그램 알림 ────────────────────────────────────────────────────────────
async function sendTelegram(token: string, chatId: string, text: string) {
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })
  } catch (_) {}
}

// ─── 자동 푸시 규칙 실행 ──────────────────────────────────────────────────────
async function fireAutoRules(triggerKey: string, userId: string, vars: Record<string,string>, adminToken: string) {
  try {
    const rules = await fsQuery('autoRules', adminToken)
    const matched = rules.filter((r: any) => r.isActive && r.triggerEvent === triggerKey)
    for (const rule of matched) {
      let title = rule.title || ''
      let message = rule.message || ''
      for (const [k, v] of Object.entries(vars)) {
        title = title.replace(`{${k}}`, v)
        message = message.replace(`{${k}}`, v)
      }
      // notifications 컬렉션에 저장 (fcmPending: true → 이후 FCM 발송)
      await fsCreate('notifications', {
        userId,
        title,
        message,
        type: rule.type || 'inbox',
        isRead: false,
        autoRuleId: rule.id,
        triggerEvent: triggerKey,
        fcmPending: true,
        createdAt: new Date().toISOString()
      }, adminToken)

      // 🔔 FCM 즉시 발송 시도 (실패해도 notifications는 이미 저장됨)
      try {
        await sendFcmToUser(userId, title, message, { triggerEvent: triggerKey }, adminToken)
      } catch (_) {}

      // triggerCount 증가
      await fsPatch(`autoRules/${rule.id}`, {
        triggerCount: (rule.triggerCount || 0) + 1
      }, adminToken)
    }
  } catch (_) {}
}

// ─── 보조계정 로그인 ──────────────────────────────────────────────────────────
app.post('/api/subadmin/login', async (c) => {
  try {
    const { loginId, password } = await c.req.json()
    if (!loginId || !password) return c.json({ error: '아이디와 비밀번호를 입력하세요.' }, 400)

    const adminToken = await getAdminToken()
    const subAdmins = await fsQuery('subAdmins', adminToken)
    const account = subAdmins.find((a: any) => a.loginId === loginId && a.isActive)
    if (!account) return c.json({ error: '존재하지 않거나 비활성화된 계정입니다.' }, 401)

    // SHA-256 비밀번호 검증
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    if (account.passwordHash !== hashHex) return c.json({ error: '비밀번호가 틀렸습니다.' }, 401)

    // 만료 확인
    if (account.expireType === 'date' && account.expireAt) {
      if (new Date(account.expireAt) < new Date()) return c.json({ error: '만료된 계정입니다.' }, 401)
    }

    // JWT 토큰 발급 (간단한 구조)
    const payload = {
      uid: account.id,
      loginId: account.loginId,
      name: account.name,
      role: 'subadmin',
      permissions: account.permissions || {},
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    }
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const token = `${headerB64}.${payloadB64}.subadmin_sig`

    // 로그인 횟수 업데이트
    await fsPatch(`subAdmins/${account.id}`, {
      lastLogin: new Date().toISOString(),
      triggerCount: (account.triggerCount || 0) + 1
    }, adminToken)

    return c.json({ success: true, token, name: account.name, permissions: account.permissions || {} })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 관리자 회원 비밀번호 변경 ────────────────────────────────────────────────
// ─── 회원 자산 변경 이력 조회 ──────────────────────────────────────────────────
app.get('/api/admin/member-edit-logs', async (c) => {
  try {
    const userId = c.req.query('userId')
    if (!userId) return c.json({ error: 'userId 필요' }, 400)
    const adminToken = await getAdminToken()
    const logs = await fsQuery('memberEditLogs', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ], 100)
    logs.sort((a: any, b: any) => (b.createdAt?._seconds || b.createdAt?.seconds || 0) - (a.createdAt?._seconds || a.createdAt?.seconds || 0))

    // adminId가 있는 경우 관리자 이름 조회해서 붙여주기
    const adminIdSet = [...new Set(logs.map((l: any) => l.adminId).filter(Boolean))]
    const adminNameMap: Record<string, string> = {}
    await Promise.all(adminIdSet.map(async (aid: any) => {
      try {
        const adm = await fsGet('users/' + aid, adminToken)
        const name = adm?.fields?.name ? fromFirestoreValue(adm.fields.name) : null
        const email = adm?.fields?.email ? fromFirestoreValue(adm.fields.email) : null
        adminNameMap[aid] = name || email || aid
      } catch { adminNameMap[aid] = aid }
    }))
    const enriched = logs.map((l: any) => ({
      ...l,
      adminName: l.adminId ? (adminNameMap[l.adminId] || l.adminId) : '관리자'
    }))
    return c.json({ success: true, data: enriched })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/reset-member-password', async (c) => {
  try {
    const { uid, newPassword, adminSecret } = await c.req.json()
    if (adminSecret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    if (!uid || !newPassword || newPassword.length < 6) return c.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400)

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: uid, password: newPassword })
      }
    )
    if (!res.ok) {
      const err: any = await res.json()
      return c.json({ error: err?.error?.message || 'UNKNOWN' }, 400)
    }

    const adminToken = await getAdminToken()
    await fsCreate('auditLogs', {
      action: 'reset_member_password',
      targetId: uid,
      detail: '관리자가 회원 비밀번호 임시 변경',
      createdAt: new Date().toISOString()
    }, adminToken)

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 관리자 회원 임포트 ───────────────────────────────────────────────────────
// ─── [1] username 로그인 API ──────────────────────────────────────────────────
// 클라이언트가 username + password로 POST → 서버가 username으로 email 조회 → Firebase Auth로 로그인 → idToken 반환
app.post('/api/auth/login-by-username', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (!username || !password) return c.json({ error: '아이디와 비밀번호를 입력하세요.' }, 400)

    const adminToken = await getAdminToken()

    // username 필드로 users 조회
    const users = await fsQuery('users', adminToken, [
      { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: username.trim() } } }
    ], 1)

    if (!users.length) return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
    const user = users[0]
    const email = user.email || user.fields?.email?.stringValue

    if (!email) return c.json({ error: '계정 이메일 정보가 없습니다. 관리자에게 문의하세요.' }, 400)

    // Firebase Auth에 email+password로 로그인
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    )
    const authData: any = await authRes.json()
    if (!authRes.ok) {
      const msg = authData?.error?.message || ''
      if (msg.includes('INVALID_PASSWORD') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
        return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
      }
      if (msg.includes('USER_DISABLED')) return c.json({ error: '정지된 계정입니다.' }, 403)
      return c.json({ error: '로그인 실패: ' + msg }, 400)
    }

    return c.json({
      success: true,
      idToken:      authData.idToken,
      refreshToken: authData.refreshToken,
      expiresIn:    authData.expiresIn,
      email,
      uid:          authData.localId
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── [2] referralCode → username 마이그레이션 API ────────────────────────────
// referralCode 필드에 잘못 들어간 값(실제 ID)을 username으로 이동하고
// referralCode는 uid 기반으로 새로 생성 (기존 referredBy 체인은 유지)
app.post('/api/admin/migrate-username', async (c) => {
  try {
    const { secret } = await c.req.json()
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

    const adminToken = await getAdminToken()
    // 전체 회원 조회
    const allUsers = await fsQuery('users', adminToken, [], 5000)

    let migrated = 0, skipped = 0, failed = 0
    const errors: string[] = []

    for (const u of allUsers) {
      try {
        const uid = u.id || u.uid
        if (!uid || u.role === 'admin') { skipped++; continue }

        // 이미 username 필드가 있으면 건너뜀
        if (u.username) { skipped++; continue }

        // referralCode에 있는 값이 실제 ID → username으로 이동
        const currentReferralCode = u.referralCode || ''

        // 새 referralCode 생성: uid 앞 8자 대문자
        const newReferralCode = uid.slice(0, 8).toUpperCase()

        await fsPatch(`users/${uid}`, {
          username:     currentReferralCode,   // 기존 referralCode 값 → username
          referralCode: newReferralCode,        // 새 referralCode (uid 기반)
        }, adminToken)

        migrated++
      } catch (e: any) {
        failed++
        errors.push(`${u.id}: ${e.message}`)
      }
    }

    return c.json({
      success: true,
      total: allUsers.length,
      migrated,
      skipped,
      failed,
      errors: errors.slice(0, 20)
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── [3] 일괄 비밀번호 000000 설정 API ────────────────────────────────────────
// username이 있는 모든 회원(임포트된 회원)의 비밀번호를 000000으로 설정
app.post('/api/admin/bulk-reset-password', async (c) => {
  try {
    const { secret, password: newPw } = await c.req.json()
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

    const targetPassword = newPw || '000000'
    const adminToken = await getAdminToken()

    // username 필드가 있는 회원만 (= 임포트된 회원)
    const users = await fsQuery('users', adminToken, [], 5000)
    const targets = users.filter((u: any) => u.username && u.role !== 'admin')

    let success = 0, failed = 0
    const errors: string[] = []

    // Firebase Admin REST API로 비밀번호 업데이트 (uid 기반)
    for (const u of targets) {
      const uid = u.id || u.uid
      if (!uid) { failed++; continue }
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ localId: uid, password: targetPassword })
          }
        )
        if (res.ok) { success++ } else { failed++; errors.push(uid) }
      } catch { failed++; errors.push(uid) }
    }

    return c.json({
      success: true,
      total: targets.length,
      updated: success,
      failed,
      errors: errors.slice(0, 20)
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/import-members', async (c) => {
  try {
    const body = await c.req.json()
    if (body.secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    const members: any[] = body.members || []
    const adminToken = await getAdminToken()
    let success = 0, failed = 0
    for (const m of members) {
      try {
        if (!m.uid || !m.email) { failed++; continue }
        await fsSet(`users/${m.uid}`, {
          uid: m.uid, email: m.email, name: m.name || '',
          role: m.role || 'member', rank: m.rank || 'G0',
          status: m.status || 'active',
          username: m.username || null,  // 구 시스템 로그인 ID
          referralCode: m.referralCode || m.uid.slice(0, 8).toUpperCase(),
          referredBy: m.referredBy || null,
          phone: m.phone || '', createdAt: m.createdAt || new Date().toISOString()
        }, adminToken)
        success++
      } catch (_) { failed++ }
    }
    return c.json({ success: true, imported: success, failed })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── DDRA 토큰 주소 설정 ──────────────────────────────────────────────────────
app.post('/api/admin/set-ddra-token', async (c) => {
  try {
    const { mintAddress, pairAddress, secret } = await c.req.json()
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    const adminToken = await getAdminToken()
    await fsPatch('settings/main', {
      'ddraToken.mintAddress': mintAddress || '',
      'ddraToken.pairAddress': pairAddress || '',
      updatedAt: new Date().toISOString()
    }, adminToken)
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 트론 입금 감지 ───────────────────────────────────────────────────────────
app.post('/api/tron/check-deposits', async (c) => {
  try {
    const { secret, depositAddress } = await c.req.json()
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    if (!depositAddress) return c.json({ error: 'depositAddress required' }, 400)

    const adminToken = await getAdminToken()

    // TronScan API로 최근 TRC20 트랜잭션 조회
    const tronRes = await fetch(
      `https://apilist.tronscanapi.com/api/token_trc20/transfers?toAddress=${depositAddress}&limit=20&start=0&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`,
      { headers: { 'User-Agent': 'DEEDRA/1.0' }, signal: AbortSignal.timeout(10000) }
    )
    if (!tronRes.ok) return c.json({ error: 'TronScan API error' }, 500)
    const tronData: any = await tronRes.json()
    const transfers = tronData.token_transfers || []

    let processed = 0
    for (const tx of transfers) {
      const txHash = tx.transaction_id
      if (!txHash) continue

      // 이미 처리된 tx인지 확인
      const existing = await fsQuery('transactions', adminToken)
      const alreadyProcessed = existing.find((t: any) => t.txHash === txHash && t.status === 'approved')
      if (alreadyProcessed) continue

      // 금액 계산 (USDT TRC20 = 6 decimals)
      const amount = parseFloat(tx.quant || '0') / 1_000_000
      if (amount < 1) continue

      // 해당 지갑 주소로 등록된 회원 찾기
      const fromAddress = tx.from_address
      const users = await fsQuery('users', adminToken)
      const matchedUser = users.find((u: any) => u.depositWalletAddress === depositAddress || u.trcWallet === fromAddress)

      if (matchedUser) {
        // 자동 입금 승인 처리
        const txId = `tron_${txHash.slice(0, 16)}`
        await fsSet(`transactions/${txId}`, {
          userId: matchedUser.id,
          type: 'deposit',
          amount,
          amountUsdt: amount,
          txHash,
          status: 'approved',
          source: 'tron_auto',
          createdAt: new Date().toISOString(),
          approvedAt: new Date().toISOString()
        }, adminToken)

        // 잔액 업데이트
        const wallet = await fsGet(`wallets/${matchedUser.id}`, adminToken)
        const currentBalance = wallet ? fromFirestoreValue(wallet.fields?.usdtBalance || { doubleValue: 0 }) : 0
        await fsPatch(`wallets/${matchedUser.id}`, {
          usdtBalance: (currentBalance || 0) + amount,
          totalDeposit: ((wallet ? fromFirestoreValue(wallet.fields?.totalDeposit || { doubleValue: 0 }) : 0) || 0) + amount
        }, adminToken)

        // 자동 푸시
        await fireAutoRules('deposit_complete', matchedUser.id, {
          amount: amount.toFixed(2), currency: 'USDT', txHash: txHash.slice(0, 16)
        }, adminToken)
        processed++
      }
    }
    return c.json({ success: true, processed, total: transfers.length })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// GET /api/tron/tx/:txHash
app.get('/api/tron/tx/:txHash', async (c) => {
  const txHash = c.req.param('txHash')
  try {
    const res = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`, {
      headers: { 'User-Agent': 'DEEDRA/1.0' }, signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return c.json({ error: 'not found' }, 404)
    const data = await res.json()
    return c.json(data)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 일일 ROI 자동 정산 ───────────────────────────────────────────────────────
app.get('/api/cron/settle', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
  return runSettle(c)
})

app.post('/api/cron/settle', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
  return runSettle(c)
})

// ── 예약 발송 독립 실행 엔드포인트 (매 시간 Cron Trigger로 호출 가능) ──────────
app.get('/api/cron/process-scheduled', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
  try {
    const adminToken = await getAdminToken()
    await processScheduledBroadcasts(adminToken)
    return c.json({ success: true, message: '예약 발송 처리 완료', processedAt: new Date().toISOString() })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.post('/api/cron/process-scheduled', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
  try {
    const adminToken = await getAdminToken()
    await processScheduledBroadcasts(adminToken)
    return c.json({ success: true, message: '예약 발송 처리 완료', processedAt: new Date().toISOString() })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 디바이스 토큰 등록 ─────────────────────────────────────────────────
app.post('/api/fcm/register', async (c) => {
  try {
    const { userId, token, platform, userAgent } = await c.req.json()
    if (!userId || !token) return c.json({ error: '필수값 누락' }, 400)
    const adminToken = await getAdminToken()

    // fcmTokens 컬렉션에 저장 (userId 기준으로 upsert)
    // 동일 userId의 기존 토큰 조회
    const existing = await fsQuery('fcmTokens', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ], 10)

    if (existing.length > 0) {
      // 기존 토큰 업데이트
      const docId = existing[0].id
      await fsPatch(`fcmTokens/${docId}`, {
        token,
        platform: platform || 'web',
        userAgent: userAgent || '',
        updatedAt: new Date().toISOString(),
        isActive: true,
      }, adminToken)
    } else {
      // 새 토큰 저장
      await fsCreate('fcmTokens', {
        userId,
        token,
        platform: platform || 'web',
        userAgent: userAgent || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      }, adminToken)
    }

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 단일 발송 (userId 기준) ────────────────────────────────────────────
app.post('/api/fcm/send', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b?.secret } catch (_) {}
  }
  // 내부 호출용 (CRON_SECRET 또는 관리자 Firebase UID 검증)
  const body = await c.req.json().catch(() => ({}))
  if (secret !== CRON_SECRET && !body.adminUid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const { userId, title, message, data } = body
    if (!userId || !title) return c.json({ error: '필수값 누락' }, 400)

    const adminToken = await getAdminToken()
    const result = await sendFcmToUser(userId, title, message || '', data || {}, adminToken)
    return c.json({ success: true, ...result })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 일괄 발송 (notifications 컬렉션 미처리 푸시 처리) ─────────────────
app.post('/api/fcm/process-notifications', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

  try {
    const adminToken = await getAdminToken()
    const sent = await processPendingFcmNotifications(adminToken)
    return c.json({ success: true, sent, processedAt: new Date().toISOString() })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 헬퍼: 특정 유저에게 푸시 발송 ──────────────────────────────────────
async function sendFcmToUser(userId: string, title: string, body: string, data: Record<string,string>, adminToken: string): Promise<{sent: number, tokens: number}> {
  // 해당 유저의 활성 FCM 토큰 조회
  const tokenDocs = await fsQuery('fcmTokens', adminToken, [
    { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
    { fieldFilter: { field: { fieldPath: 'isActive' }, op: 'EQUAL', value: { booleanValue: true } } }
  ], 5)

  if (!tokenDocs.length) return { sent: 0, tokens: 0 }

  // FCM OAuth 토큰 (서비스 계정 기반, Firestore용 토큰 재사용 불가 → 별도 발급)
  const fcmToken = await getFcmOAuthToken()

  let sent = 0
  for (const doc of tokenDocs) {
    const fcmDeviceToken = doc.token
    if (!fcmDeviceToken) continue

    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/dedra-mlm/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${fcmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: fcmDeviceToken,
              notification: { title, body },
              data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
              webpush: {
                notification: {
                  title,
                  body,
                  icon: '/static/icon-192.png',
                  badge: '/static/favicon.ico',
                  tag: 'deedra-push',
                  requireInteraction: false,
                },
                fcm_options: { link: '/' }
              }
            }
          })
        }
      )

      if (res.ok) {
        sent++
      } else {
        const err = await res.json().catch(() => ({}))
        // 토큰 만료/무효 시 비활성화
        if (err?.error?.code === 404 || err?.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
          await fsPatch(`fcmTokens/${doc.id}`, { isActive: false, invalidAt: new Date().toISOString() }, adminToken)
        }
      }
    } catch (_) {}
  }

  return { sent, tokens: tokenDocs.length }
}

// ─── FCM OAuth2 토큰 발급 (firebase messaging 전용 scope) ────────────────────
async function getFcmOAuthToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }
  const b64url = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const sigInput = `${b64url(header)}.${b64url(payload)}`

  const pemKey = SERVICE_ACCOUNT.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const jwt = `${sigInput}.${sigB64}`

  const tokenRes = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const tokenData: any = await tokenRes.json()
  return tokenData.access_token
}

// ─── FCM 미처리 알림 일괄 발송 ────────────────────────────────────────────────
async function processPendingFcmNotifications(adminToken: string): Promise<number> {
  try {
    // fcmPending=true 인 notifications 조회 (최대 50건)
    const notifications = await fsQuery('notifications', adminToken, [
      { fieldFilter: { field: { fieldPath: 'fcmPending' }, op: 'EQUAL', value: { booleanValue: true } } }
    ], 50)

    if (!notifications.length) return 0

    // FCM OAuth 토큰 한번만 발급
    const fcmToken = await getFcmOAuthToken()
    let sent = 0

    for (const notif of notifications) {
      try {
        const userId = notif.userId
        if (!userId) continue

        // 토큰 조회
        const tokenDocs = await fsQuery('fcmTokens', adminToken, [
          { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
          { fieldFilter: { field: { fieldPath: 'isActive' }, op: 'EQUAL', value: { booleanValue: true } } }
        ], 3)

        for (const tokenDoc of tokenDocs) {
          if (!tokenDoc.token) continue
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/dedra-mlm/messages:send`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${fcmToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: {
                  token: tokenDoc.token,
                  notification: { title: notif.title || 'DEEDRA', body: notif.message || '' },
                  webpush: {
                    notification: {
                      title: notif.title || 'DEEDRA',
                      body: notif.message || '',
                      icon: '/static/icon-192.png',
                      tag: 'deedra-push',
                    }
                  }
                }
              })
            }
          )
          if (res.ok) sent++
          else {
            const errBody = await res.json().catch(() => ({}))
            if (errBody?.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
              await fsPatch(`fcmTokens/${tokenDoc.id}`, { isActive: false }, adminToken)
            }
          }
        }

        // 처리 완료 표시
        await fsPatch(`notifications/${notif.id}`, { fcmPending: false, fcmSentAt: new Date().toISOString() }, adminToken)
      } catch (_) {}
    }

    return sent
  } catch (_) { return 0 }
}

async function runSettle(c: any) {
  const startTime = Date.now()
  try {
    const adminToken = await getAdminToken()
    const today = new Date().toISOString().slice(0, 10)

    // 중복 정산 방지
    const existing = await fsGet(`settlements/${today}`, adminToken)
    if (existing && existing.fields) {
      const status = fromFirestoreValue(existing.fields.status || { stringValue: '' })
      if (status === 'done') return c.json({ success: true, message: '이미 오늘 정산 완료됨', date: today })
    }

    // 진행중 투자 목록 조회
    const investments = await fsQuery('investments', adminToken, [], 500)
    const activeInvestments = investments.filter((inv: any) => inv.status === 'active')

    // 시스템 설정 조회 (이율 정보)
    const settings = await fsGet('settings/main', adminToken)
    const settingsData = settings?.fields ? firestoreDocToObj(settings) : {}

    let totalPaid = 0
    let processedCount = 0
    const details: any[] = []

    for (const inv of activeInvestments) {
      try {
        // 만료 체크
        const endDate = new Date(inv.endDate)
        if (endDate < new Date()) {
          await fsPatch(`investments/${inv.id}`, { status: 'expired' }, adminToken)
          // 만료 자동 푸시
          await fireAutoRules('investment_expire', inv.userId, {
            productName: inv.packageName || inv.productName || '',
            amount: String(inv.amountUsdt || 0)
          }, adminToken)
          continue
        }

        // D-7 만료 예정 알림
        const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysLeft === 7) {
          await fireAutoRules('investment_expire_soon', inv.userId, {
            productName: inv.packageName || inv.productName || '',
            daysLeft: '7'
          }, adminToken)
        }

        // ROI 계산 (일일)
        const roiPct = inv.roiPct || inv.roiPercent || inv.dailyRoi || 0
        const principal = inv.amountUsdt || inv.amount || 0
        // roiPct가 총 수익률이면 기간으로 나눔, 일일 수익률이면 그대로
        const durationDays = inv.durationDays || inv.duration || 30
        const dailyRoiPct = roiPct > 1 ? roiPct / durationDays : roiPct
        const dailyEarning = principal * (dailyRoiPct / 100)

        if (dailyEarning <= 0) continue

        // DDRA 환산 (시세 조회)
        let ddraPrice = 0.5
        try {
          const priceRes = await fetch('https://ddra.io/api/price/token?pair=CCWoFv', { signal: AbortSignal.timeout(3000) })
          if (priceRes.ok) { const pd: any = await priceRes.json(); ddraPrice = pd.price || 0.5 }
        } catch (_) {}
        const ddraAmount = ddraPrice > 0 ? dailyEarning / ddraPrice : dailyEarning

        // wallets 업데이트
        const wallet = await fsGet(`wallets/${inv.userId}`, adminToken)
        const wData = wallet?.fields ? firestoreDocToObj(wallet) : {}
        await fsPatch(`wallets/${inv.userId}`, {
          dedraBalance: (wData.dedraBalance || 0) + ddraAmount,
          totalEarnings: (wData.totalEarnings || 0) + dailyEarning
        }, adminToken)

        // investments paidRoi 업데이트
        await fsPatch(`investments/${inv.id}`, {
          paidRoi: (inv.paidRoi || 0) + dailyEarning,
          lastSettledAt: new Date().toISOString()
        }, adminToken)

        // bonuses 기록
        await fsCreate('bonuses', {
          userId: inv.userId,
          type: 'roi',
          amount: ddraAmount,
          amountUsdt: dailyEarning,
          reason: `일일 ROI 정산 (${today})`,
          investmentId: inv.id,
          createdAt: new Date().toISOString()
        }, adminToken)

        // roi_claimed 자동 푸시
        await fireAutoRules('roi_claimed', inv.userId, {
          amount: dailyEarning.toFixed(4),
          ddraAmount: ddraAmount.toFixed(2),
          date: today
        }, adminToken)

        totalPaid += dailyEarning
        processedCount++
        details.push({ userId: inv.userId, investmentId: inv.id, paid: dailyEarning, ddra: ddraAmount })
      } catch (_) { continue }
    }

    // 예약 발송 자동 실행
    await processScheduledBroadcasts(adminToken)

    // 장기 미접속 / 잔액 부족 Cron 체크
    await checkInactiveUsers(adminToken)
    await checkLowBalances(adminToken)

    // 정산 기록 저장
    await fsSet(`settlements/${today}`, {
      date: today,
      totalPaid,
      totalUsers: processedCount,
      details,
      status: 'done',
      duration: Date.now() - startTime,
      createdAt: new Date().toISOString()
    }, adminToken)

    // 텔레그램 알림
    const tgSettings = settingsData.telegram || {}
    if (tgSettings.botToken && tgSettings.chatId) {
      await sendTelegram(tgSettings.botToken, tgSettings.chatId,
        `✅ <b>일일 ROI 정산 완료</b>\n📅 날짜: ${today}\n👥 처리: ${processedCount}명\n💰 지급: $${totalPaid.toFixed(4)} USDT`)
    }

    return c.json({ success: true, date: today, totalPaid, processedCount, duration: Date.now() - startTime })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
}

// ─── 예약 발송 자동 실행 ──────────────────────────────────────────────────────
async function processScheduledBroadcasts(adminToken: string) {
  try {
    const nowMs = Date.now()
    const scheduled = await fsQuery('scheduledBroadcasts', adminToken, [], 50)
    // scheduledAt 은 Firestore Timestamp({_seconds, _nanoseconds}) 또는 ISO 문자열일 수 있음
    const toMs = (v: any): number => {
      if (!v) return Infinity
      if (typeof v === 'string') return new Date(v).getTime()
      if (typeof v === 'number') return v
      if (v._seconds !== undefined) return v._seconds * 1000
      return Infinity
    }
    const pending = scheduled.filter((b: any) => b.status === 'pending' && toMs(b.scheduledAt) <= nowMs)

    for (const broadcast of pending) {
      try {
        // 상태를 sending으로 변경
        await fsPatch(`scheduledBroadcasts/${broadcast.id}`, { status: 'sending' }, adminToken)

        // 대상 회원 조회
        const users = await fsQuery('users', adminToken, [], 1000)
        let targets = users.filter((u: any) => u.status === 'active')
        if (broadcast.targetGroup && broadcast.targetGroup !== 'all' && broadcast.targetGroup !== 'specific') {
          targets = targets.filter((u: any) => u.rank === broadcast.targetGroup)
        }
        // 특정 회원 대상 (autoRules에서 생성된 개인 예약 알림)
        if (broadcast.targetGroup === 'specific' && broadcast.specificUserId) {
          targets = users.filter((u: any) => u.id === broadcast.specificUserId)
        }

        // 알림 발송
        for (const user of targets) {
          await fsCreate('notifications', {
            userId: user.id,
            title: broadcast.title || '',
            message: broadcast.message || '',
            type: broadcast.type || 'broadcast',
            priority: broadcast.priority || 'normal',
            icon: broadcast.icon || '🔔',
            color: broadcast.color || '#10b981',
            isRead: false,
            broadcastId: broadcast.id,
            autoRuleId: broadcast.autoRuleId || null,
            triggerEvent: broadcast.triggerEvent || null,
            createdAt: new Date().toISOString()
          }, adminToken)
        }

        // 발송 완료 처리
        await fsPatch(`scheduledBroadcasts/${broadcast.id}`, {
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentCount: targets.length
        }, adminToken)

        // broadcasts 기록 (개인 알림이 아닌 경우만)
        if (broadcast.targetGroup !== 'specific') {
          await fsCreate('broadcasts', {
            title: broadcast.title,
            message: broadcast.message,
            targetGroup: broadcast.targetGroup || 'all',
            sentAt: new Date().toISOString(),
            sentBy: 'scheduler',
            sentCount: targets.length
          }, adminToken)
        }
      } catch (_) {
        await fsPatch(`scheduledBroadcasts/${broadcast.id}`, { status: 'failed' }, adminToken)
      }
    }
  } catch (_) {}
}

// ─── 장기 미접속 체크 ─────────────────────────────────────────────────────────
async function checkInactiveUsers(adminToken: string) {
  try {
    const users = await fsQuery('users', adminToken, [], 500)
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    for (const user of users) {
      if (user.status !== 'active') continue
      const lastLogin = user.lastLogin || user.createdAt || ''
      if (lastLogin && lastLogin < threshold) {
        await fireAutoRules('no_login_days', user.id, {
          days: '7', email: user.email || ''
        }, adminToken)
      }
    }
  } catch (_) {}
}

// ─── 잔액 부족 체크 ───────────────────────────────────────────────────────────
async function checkLowBalances(adminToken: string) {
  try {
    const wallets = await fsQuery('wallets', adminToken, [], 500)
    for (const wallet of wallets) {
      if ((wallet.usdtBalance || 0) < 10 && (wallet.dedraBalance || 0) < 10) {
        await fireAutoRules('balance_low', wallet.userId || wallet.id, {
          usdt: String((wallet.usdtBalance || 0).toFixed(2)),
          ddra: String((wallet.dedraBalance || 0).toFixed(2))
        }, adminToken)
      }
    }
  } catch (_) {}
}

// ─── 공지사항 자동 번역 API ───────────────────────────────────────────────────
// MyMemory 무료 번역 API 사용 (API키 불필요, 한국어 지원)
// 하루 5,000자 무료 (일반 공지사항 충분)
// 관리자가 한국어로 공지 저장 시 en/vi/th 자동 번역하여 함께 저장

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return ''
  // HTML 태그 제거하여 텍스트만 번역
  const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!plainText) return ''

  // MyMemory API: 무료, API키 불필요, 한국어 지원
  // 언어코드 매핑
  const langMap: Record<string, string> = { en: 'en', vi: 'vi', th: 'th' }
  const targetCode = langMap[targetLang] || targetLang

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(plainText)}&langpair=ko|${targetCode}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return ''
    const data: any = await res.json()
    if (data?.responseStatus === 200 && data?.responseData?.translatedText) {
      return data.responseData.translatedText
    }
  } catch (_) {}
  return ''
}

app.post('/api/translate/announcement', async (c) => {
  try {
    const { title, content } = await c.req.json()
    if (!title && !content) return c.json({ error: 'title or content required' }, 400)

    const targets = ['en', 'vi', 'th']
    const result: any = {}

    // 순차 처리 (MyMemory rate limit 고려)
    for (const lang of targets) {
      const [translatedTitle, translatedContent] = await Promise.all([
        title ? translateText(title, lang) : Promise.resolve(''),
        content ? translateText(content, lang) : Promise.resolve('')
      ])
      result[`title_${lang}`] = translatedTitle
      result[`content_${lang}`] = translatedContent
    }

    return c.json({ success: true, translations: result })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default app
