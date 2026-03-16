import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
// @ts-ignore
import ADMIN_HTML from '../public/static/admin.html?raw'
// @ts-ignore
import INDEX_HTML from '../public/index.html?raw'

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


// ─── Auto News Digest (소식통) API ───────────────────────────────────────────
app.get('/api/news-digest', async (c) => {
  try {
    const rssUrl = 'https://www.blockmedia.co.kr/feed';
    const resp = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) return c.json({ items: [] });
    
    const xml = await resp.text();
    // A simple regex-based XML parser for the items
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      if (items.length >= 10) break; // Limit to 10
      const itemStr = match[1];
      
      const titleMatch = itemStr.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemStr.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemStr.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = itemStr.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemStr.match(/<description>([\s\S]*?)<\/description>/);
      const dateMatch = itemStr.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      
      if (titleMatch && linkMatch) {
        // clean up description HTML tags
        let desc = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').trim() : '';
        if (desc.length > 150) desc = desc.substring(0, 150) + '...';
        
        items.push({
          title: titleMatch[1].trim(),
          link: linkMatch[1].trim(),
          description: desc,
          pubDate: dateMatch ? dateMatch[1].trim() : ''
        });
      }
    }
    return c.json({ items });
  } catch (err) {
    console.error('RSS Fetch error:', err);
    return c.json({ items: [] }, 500);
  }
})

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


app.get('/', (c) => c.html(INDEX_HTML))
app.get('/app', (c) => c.html(INDEX_HTML))

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
      <tr><td>test1@deedra.com</td><td>000000</td><td>G1</td><td>1,000</td><td>500</td></tr>
      <tr><td>test2@deedra.com</td><td>000000</td><td>G0</td><td>500</td><td>200</td></tr>
      <tr><td>test3@deedra.com</td><td>000000</td><td>G2</td><td>5,000</td><td>2,000</td></tr>
    </table>
    <p style="margin:6px 0 0;font-size:11px;color:#9ca3af">출금 PIN: 123456</p>
  </div>

  <div class="section" style="margin-top:16px;background:#1e293b;border-radius:10px;padding:16px;">
    <div class="section-title" style="color:#f59e0b">🔐 관리자 계정 생성</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
      <input id="adminEmail" type="email" placeholder="관리자 이메일" value="admin@deedra.com"
        style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;flex:1;min-width:200px;"/>
      <input id="adminPass" type="text" placeholder="비밀번호 (6자리 이상)" value="000000"
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
  { email:'test1@deedra.com', password:'000000', name:'테스트1호', rank:'G1', usdt:1000, dedra:500,  bonus:50,  referralCode:'TEST0001' },
  { email:'test2@deedra.com', password:'000000', name:'테스트2호', rank:'G0', usdt:500,  dedra:200,  bonus:20,  referralCode:'TEST0002' },
  { email:'test3@deedra.com', password:'000000', name:'테스트3호', rank:'G2', usdt:5000, dedra:2000, bonus:300, referralCode:'TEST0003' },
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
  if (pass.length < 6) { log('❌ 비밀번호는 최소 6자리 이상이어야 합니다.', '#fca5a5'); return; }
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
      solana: 'SOL_WALLET_ADDRESS_SET_BY_ADMIN',
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

// ─── Firebase Custom Token 발급 (보조계정 Firestore 접근용) ──────────────────
async function createFirebaseCustomToken(uid: string, claims: Record<string, any> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  // claims는 단순 문자열만 포함하도록 직렬화 (한글/특수문자 안전 처리)
  const safeClaims: Record<string, string> = {}
  for (const [k, v] of Object.entries(claims)) {
    safeClaims[k] = typeof v === 'string' ? v : JSON.stringify(v)
  }
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytools.v1.IdentityToolkit',
    uid: uid,
    iat: now,
    exp: now + 3600,
    claims: safeClaims
  }
  // UTF-8 안전한 base64url 인코딩
  const b64url = (obj: any) => {
    const str = JSON.stringify(obj)
    const bytes = new TextEncoder().encode(str)
    let bin = ''
    bytes.forEach(b => bin += String.fromCharCode(b))
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  }
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
  return `${sigInput}.${sigB64}`
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

/**
 * fsCreateOnlyIfAbsent: Firestore precondition 을 이용해
 * 문서가 존재하지 않을 때만 생성 (exist=false 조건부 PATCH).
 * 이미 존재하면 HTTP 409/412 를 반환하고 null 을 리턴.
 * → 다수의 동시 요청 중 단 하나만 성공 → Race-condition 방지용 분산 Lock.
 */
async function fsCreateOnlyIfAbsent(path: string, data: any, token: string): Promise<boolean> {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  // currentDocument.exists=false → 문서가 없을 때만 쓰기 허용
  const res = await fetch(`${FIRESTORE_BASE}/${path}?currentDocument.exists=false`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  return res.ok  // true = 내가 lock 획득, false = 이미 다른 프로세스가 lock 보유
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
      // perms 우선, permissions 폴백 (Firestore 저장 필드명 혼용 대응)
      perms:       account.perms       || account.permissions || {},
      permissions: account.permissions || account.perms       || {},
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    }
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const token = `${headerB64}.${payloadB64}.subadmin_sig`

    // Firebase Custom Token 발급 (Firestore 직접 접근 허용용)
    // uid는 'subadmin_<account.id>' 형태로 고정 prefix 사용 → 규칙에서 isSubAdmin() 판별
    const saFirebaseUid = `subadmin_${account.id}`
    let customToken = ''
    try {
      customToken = await createFirebaseCustomToken(saFirebaseUid, {
        role: 'subadmin'
        // perms는 claims에서 제외 (직렬화 복잡도 방지 - 프론트에서 JWT payload로 전달)
      })
    } catch(e: any) {
      console.error('[subadmin/login] customToken 발급 실패:', e.message)
    }

    // 로그인 횟수 업데이트
    await fsPatch(`subAdmins/${account.id}`, {
      lastLogin: new Date().toISOString(),
      triggerCount: (account.triggerCount || 0) + 1
    }, adminToken)

    return c.json({
      success: true,
      token,
      customToken,
      uid:  saFirebaseUid,
      name: account.name,
      perms:       account.perms       || account.permissions || {},
      permissions: account.permissions || account.perms       || {},
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 보조계정 Custom Token 갱신 (세션 복원용) ──────────────────────────────
app.post('/api/subadmin/refresh-token', async (c) => {
  try {
    const { loginId } = await c.req.json()
    if (!loginId) return c.json({ error: 'loginId 필요' }, 400)

    const adminToken = await getAdminToken()
    const subAdmins = await fsQuery('subAdmins', adminToken)
    const account = subAdmins.find((a: any) => a.loginId === loginId && a.isActive)
    if (!account) return c.json({ error: '계정 없음' }, 404)

    // 만료 확인
    if (account.expireType === 'date' && account.expireAt) {
      if (new Date(account.expireAt) < new Date()) return c.json({ error: '만료된 계정' }, 401)
    }

    const saFirebaseUid = `subadmin_${account.id}`
    const customToken = await createFirebaseCustomToken(saFirebaseUid, { role: 'subadmin' })

    return c.json({ success: true, customToken, uid: saFirebaseUid })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 보조계정 JWT 토큰 검증 헬퍼 ──────────────────────────────────────────────
function verifySubAdminToken(token: string): any | null {
  try {
    if (!token || !token.includes('.')) return null
    const parts = token.split('.')
    if (parts.length < 2) return null
    // base64url → JSON 디코딩
    const pad = (s: string) => s + '='.repeat((4 - s.length % 4) % 4)
    const payload = JSON.parse(atob(pad(parts[1].replace(/-/g,'+').replace(/_/g,'/'))))
    if (payload.role !== 'subadmin') return null
    if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null
    return payload
  } catch { return null }
}

// ─── 보조계정 범용 데이터 프록시 API ──────────────────────────────────────────
// 보조계정이 Firestore에 직접 접근할 수 없으므로, 백엔드가 대신 조회해서 반환
app.post('/api/subadmin/query', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const sa = verifySubAdminToken(token)
    if (!sa) return c.json({ error: '인증 실패' }, 401)

    const { collection: col, filters, limit: lim, orderByField, orderDir, docId } = await c.req.json()
    if (!col) return c.json({ error: 'collection 필요' }, 400)

    const adminToken = await getAdminToken()

    // docId가 있으면 단일 문서 직접 조회 (REST GET)
    if (docId) {
      const doc = await fsGet(`${col}/${docId}`, adminToken)
      if (!doc) return c.json({ success: true, docs: [] })
      const obj = firestoreDocToObj(doc)
      return c.json({ success: true, docs: [obj] })
    }

    // filters 변환 (__name__ 필터는 무시 - structuredQuery 미지원)
    const fsFilters = (filters || [])
      .filter((f: any) => f.field !== '__name__')
      .map((f: any) => ({
        fieldFilter: {
          field: { fieldPath: f.field },
          op: f.op || 'EQUAL',
          value: typeof f.value === 'number'
            ? { integerValue: String(f.value) }
            : typeof f.value === 'boolean'
            ? { booleanValue: f.value }
            : { stringValue: String(f.value) }
        }
      }))

    const docs = await fsQuery(col, adminToken, fsFilters, lim || 500)
    return c.json({ success: true, docs })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 보조계정 대시보드 통계 API ────────────────────────────────────────────────
app.get('/api/subadmin/dashboard-stats', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const sa = verifySubAdminToken(token)
    if (!sa) return c.json({ error: '인증 실패' }, 401)

    const adminToken = await getAdminToken()
    const [users, txs, invs] = await Promise.all([
      fsQuery('users', adminToken, [], 2000),
      fsQuery('transactions', adminToken, [], 2000),
      fsQuery('investments', adminToken, [], 2000).catch(() => []),
    ])

    const deposits    = txs.filter((t: any) => t.type === 'deposit')
    const withdrawals = txs.filter((t: any) => t.type === 'withdrawal')

    return c.json({
      success: true,
      data: {
        totalUsers:            users.filter((u: any) => u.role !== 'admin').length,
        activeUsers:           users.filter((u: any) => u.status === 'active' && u.role !== 'admin').length,
        pendingDeposits:       deposits.filter((t: any) => t.status === 'pending').length,
        pendingWithdrawals:    withdrawals.filter((t: any) => t.status === 'pending').length,
        totalDepositAmount:    deposits.filter((t: any) => t.status === 'approved').reduce((s: number, t: any) => s + (t.amount || 0), 0),
        totalWithdrawalAmount: withdrawals.filter((t: any) => t.status === 'approved').reduce((s: number, t: any) => s + (t.amount || 0), 0),
        totalGameBet:          0,
        activeInvestments:     invs.filter((i: any) => i.status === 'active').length,
        totalInvestAmount:     invs.reduce((s: number, i: any) => s + (i.amount || 0), 0),
        totalStakedAmount:     invs.filter((i: any) => i.status === 'active').reduce((s: number, i: any) => s + (i.amount || 0), 0),
      }
    })
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
    const { uid, newPassword, adminSecret, adminUid } = await c.req.json()
    // 내부 관리자 API용 인증: CRON_SECRET이 맞거나, 적법한 adminUid가 있거나
    if (adminSecret !== CRON_SECRET && !adminUid) {
        return c.json({ error: 'unauthorized' }, 401)
    }
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

// ─── [새로운 관리자 기능] 지갑 초기화 API ────────────────────────────────────────
app.post('/api/admin/wipe-wallets', async (c) => {
  try {
    const { secret, mode, targetIds } = await c.req.json()
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    
    const adminToken = await getAdminToken()
    let processed = 0
    
    // mode: 'all' 또는 'specific'
    const queryIds = mode === 'all' ? [] : (targetIds || [])
    
    const wallets = await fsQuery('wallets', adminToken, [], 5000)
    for (const w of wallets) {
      if (mode === 'all' || queryIds.includes(w.userId)) {
        await fsPatch(`wallets/${w.userId}`, {
          bonusBalance: 0,
          usdtBalance: 0,
          totalEarnings: 0,
          dedraBalance: 0
        }, adminToken)
        processed++
      }
    }
    
    await fsCreate('auditLogs', {
      action: 'wipe_wallets',
      mode,
      targetCount: processed,
      detail: `관리자가 ${processed}명의 지갑을 0으로 초기화했습니다 (${mode})`,
      createdAt: new Date().toISOString()
    }, adminToken)
    
    return c.json({ success: true, processed })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

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

// ─── Solana 입금 감지 ────────────────────────────────────────────────────────
// USDT on Solana (SPL) mint address
const USDT_SPL_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

app.post('/api/solana/check-deposits', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const secret = c.req.header('x-cron-secret') || body.secret
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

    const adminToken = await getAdminToken()

    // Firestore에서 회사 입금 지갑 주소 조회
    const settingsDoc = await fsGet('settings/companyWallets', adminToken)
    let depositAddress = '';
    if (settingsDoc && settingsDoc.fields && settingsDoc.fields.wallets && settingsDoc.fields.wallets.arrayValue && settingsDoc.fields.wallets.arrayValue.values) {
      const wallets = settingsDoc.fields.wallets.arrayValue.values;
      if (wallets.length > 0 && wallets[0].mapValue && wallets[0].mapValue.fields && wallets[0].mapValue.fields.address) {
        depositAddress = wallets[0].mapValue.fields.address.stringValue || '';
      }
    }

    if (!depositAddress || depositAddress.length < 32) {
      return c.json({ error: 'Solana deposit address not configured' }, 400)
    }

    // Solana SPL Token 트랜잭션 조회 (Helius public RPC)
    // Solana SPL Token 트랜잭션 조회 (공용 RPC로 교체)
    // Helius public key는 막힐 수 있으므로 무료 공용 엔드포인트 사용
            // QuickNode and Triton are generally more reliable for free tier
        // Use completely different RPC providers to bypass Cloudflare / regional blocks
        // Use QuickNode public and basic mainnet (avoid domains that cause CF SSL errors)
    const rpcUrls = [
      'https://solana-mainnet.core.chainstack.com/2a8a815a5bb1d9f8e4e9f3b5',
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com'
    ];
    
    let rpcRes = null;
    let successUrl = '';
    
        let lastError = '';
    for (const url of rpcUrls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getSignaturesForAddress',
            params: [
              depositAddress, 
              { limit: 20, commitment: 'confirmed' }
            ]
          }),
          signal: AbortSignal.timeout(8000)
        });
        
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (data.error) {
              lastError = data.error.message || 'RPC JSON Error';
              continue; // Try next URL if this RPC returns an error payload
            }
            
            // Create a mock response object that returns the parsed data
            rpcRes = {
              ok: true,
              json: async () => data
            };
            successUrl = url;
            break;
          } catch(e) {
            lastError = 'JSON Parse Error';
            continue;
          }
        } else {
          lastError = `HTTP ${res.status} ${res.statusText}`;
        }
      } catch (e: any) {
        lastError = e.message || 'Network Error';
      }
    }
    
    if (!rpcRes) {
      return c.json({ error: `Solana RPC error: All endpoints failed. Last error: ${lastError}` }, 500);
    }
    
    if (!rpcRes) {
      // Fallback
      return c.json({ error: 'Solana RPC error: All public endpoints failed. Network might be busy.' }, 500);
    }
    const rpcData: any = await rpcRes.json()
    const signatures: any[] = rpcData.result || []

    let processed = 0
    for (const sig of signatures) {
      const txHash = sig.signature
      if (!txHash || sig.err) continue

      // 이미 처리된 tx인지 확인
      const existing = await fsQuery('transactions', adminToken)
      const alreadyProcessed = existing.find((t: any) => t.txHash === txHash && t.status === 'approved')
      if (alreadyProcessed) continue

      // tx 상세 조회
      const txRes = await fetch(successUrl || rpcUrls[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTransaction',
          params: [txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
        }),
        signal: AbortSignal.timeout(10000)
      })
      if (!txRes.ok) continue
      const txData: any = await txRes.json()
      const tx = txData.result
      if (!tx) continue

      // SPL token transfer 파싱
      const instructions = tx.transaction?.message?.instructions || []
      let amount = 0
      let fromAddress = ''
      for (const ix of instructions) {
        if (ix.program === 'spl-token' && ix.parsed?.type === 'transfer') {
          const info = ix.parsed.info
          // USDT SPL mint 확인
          if (info.mint === USDT_SPL_MINT || info.authority) {
            amount = parseFloat(info.amount || '0') / 1_000_000 // USDT = 6 decimals
            fromAddress = info.authority || info.source || ''
          }
        }
        // transferChecked 타입도 처리
        if (ix.program === 'spl-token' && ix.parsed?.type === 'transferChecked') {
          const info = ix.parsed.info
          if (info.mint === USDT_SPL_MINT) {
            amount = parseFloat(info.tokenAmount?.uiAmount || info.tokenAmount?.amount || '0')
            if (info.tokenAmount?.decimals) amount = parseFloat(info.tokenAmount.amount) / Math.pow(10, info.tokenAmount.decimals)
            fromAddress = info.authority || info.multisigAuthority || ''
          }
        }
      }

      if (amount < 1) continue

      // 해당 지갑으로 등록된 회원 찾기
      const users = await fsQuery('users', adminToken)
      const matchedUser = users.find((u: any) =>
        u.solanaWallet === fromAddress || u.depositWalletAddress === fromAddress
      )

      if (matchedUser) {
        const txId = `sol_${txHash.slice(0, 20)}`
        await fsSet(`transactions/${txId}`, {
          userId: matchedUser.id,
          type: 'deposit',
          amount,
          amountUsdt: amount,
          txHash,
          status: 'approved',
          source: 'solana_auto',
          network: 'solana',
          createdAt: new Date().toISOString(),
          approvedAt: new Date().toISOString()
        }, adminToken)

        const wallet = await fsGet(`wallets/${matchedUser.id}`, adminToken)
        const currentBalance = wallet ? fromFirestoreValue(wallet.fields?.usdtBalance || { doubleValue: 0 }) : 0
        await fsPatch(`wallets/${matchedUser.id}`, {
          usdtBalance: (currentBalance || 0) + amount,
          totalDeposit: ((wallet ? fromFirestoreValue(wallet.fields?.totalDeposit || { doubleValue: 0 }) : 0) || 0) + amount
        }, adminToken)

        await fireAutoRules('deposit_complete', matchedUser.id, {
          amount: amount.toFixed(2), currency: 'USDT', network: 'Solana', txHash: txHash.slice(0, 20)
        }, adminToken)
        // 4. [센터피] (Center Fee) - 입금액의 5% 지급
        if (matchedUser.centerId) {
          try {
            const ratesDoc = await fsGet('settings/rates', adminToken)
            const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}
            const centerFeePct = Number(ratesData.rate_centerFee ?? 5)

            if (centerFeePct > 0) {
              const centerDoc = await fsGet(`centers/${matchedUser.centerId}`, adminToken)
              const centerData = centerDoc?.fields ? firestoreDocToObj(centerDoc) : null
              if (centerData && centerData.managerId) {
                const feeUsdt = amount * (centerFeePct / 100)
                
                const mWalletDoc = await fsGet(`wallets/${centerData.managerId}`, adminToken)
                const mwData = mWalletDoc?.fields ? firestoreDocToObj(mWalletDoc) : null
                if (mwData) {
                  await fsPatch(`wallets/${centerData.managerId}`, {
                    bonusBalance: Math.round(((mwData.bonusBalance || 0) + feeUsdt) * 1e8) / 1e8,
                    totalEarnings: Math.round(((mwData.totalEarnings || 0) + feeUsdt) * 1e8) / 1e8
                  }, adminToken)
                  
                  await fsCreate('bonuses', {
                    userId: centerData.managerId,
                    fromUserId: matchedUser.id,
                    type: 'center_fee',
                    amount: Math.round(feeUsdt / 0.5 * 1e8) / 1e8, // DEDRA rate
                    amountUsdt: feeUsdt,
                    reason: `센터피 ${centerFeePct}% (기준: ${matchedUser.name}, 입금: ${amount} USDT)`,
                    createdAt: new Date().toISOString()
                  }, adminToken)
                }
              }
            }
          } catch(e) {
            console.error("Center fee error:", e);
          }
        }

        processed++
      }
    }
    return c.json({ success: true, processed, total: signatures.length, network: 'solana' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 하위 호환: /api/tron/check-deposits → solana로 리다이렉트
app.post('/api/tron/check-deposits', async (c) => {
  return c.json({ redirected: true, message: '이 플랫폼은 Solana 기반입니다. /api/solana/check-deposits 를 사용하세요.' }, 301)
})

// GET /api/solana/tx/:signature
app.get('/api/solana/tx/:signature', async (c) => {
  const signature = c.req.param('signature')
  try {
    const res = await fetch('https://mainnet.helius-rpc.com/?api-key=public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
      }),
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return c.json({ error: 'not found' }, 404)
    const data = await res.json()
    return c.json(data.result || {})
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

// ─── 관리자 인증 수동 정산 엔드포인트 ────────────────────────────────────────
// 프론트엔드에서 Firebase ID 토큰으로 인증 후 백엔드 정산 실행
// api.js의 runDailyROISettlement()를 대체 - 프론트는 트리거만, 계산은 백엔드에서

// ─── [새로운 관리자 기능] 정산 락 해제 API ────────────────────────────────────────
app.post('/api/admin/unlock-settlement', async (c) => {
  try {
    const { secret, date } = await c.req.json()
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    
    const adminToken = await getAdminToken()
    // delete document by using fetch with DELETE method
    const url = `${FIRESTORE_BASE}/settlements/${date}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    })
    
    return c.json({ success: true, message: `${date} 정산 락이 해제되었습니다.` })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/run-settlement', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as any
    const targetDate = body.targetDate || null  // YYYY-MM-DD or null=today
    return runSettle(c, targetDate)
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})


// ── Rank Logic Helpers ────────────────────────────────────────────────────────
const RANK_ORDER: Record<string, number> = {
  'G0': 0, 'G1': 1, 'G2': 2, 'G3': 3, 'G4': 4,
  'G5': 5, 'G6': 6, 'G7': 7, 'G8': 8, 'G9': 9, 'G10': 10
}
function getRankLevel(rankStr: string): number {
  return RANK_ORDER[rankStr] || 0
}

async function runSettle(c: any, overrideDate?: string | null) {
  const startTime = Date.now()
  try {
    const adminToken = await getAdminToken()
    const today = overrideDate || new Date().toISOString().slice(0, 10)

    // ── Atomic 중복 정산 방지 (Distributed Lock) ────────────────────────────
    // Firestore precondition(currentDocument.exists=false) 을 이용한 분산 락:
    // - 다수의 동시 요청 중 **단 하나**만 문서 생성에 성공 → 나머지는 즉시 skip
    // - lock 문서 생성 전에 먼저 done/processing 상태를 확인하여 재실행도 방지
    // ─────────────────────────────────────────────────────────────────────────

    // 0단계: 이미 완료/진행 중인 정산이 있는지 선확인
    const existing = await fsGet(`settlements/${today}`, adminToken)
    if (existing && existing.fields) {
      const existStatus = fromFirestoreValue(existing.fields.status || { stringValue: '' })
      if (existStatus === 'done' || existStatus === 'processing') {
        return c.json({ success: true, message: `이미 ${today} 정산 처리됨 (status:${existStatus})`, date: today, skipped: true })
      }
    }

    // 1단계: 분산 Lock — 문서가 없을 때만 'processing' 으로 생성 (precondition)
    const processId = `settle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const lockAcquired = await fsCreateOnlyIfAbsent(`settlements/${today}`, {
      date: today,
      status: 'processing',
      processId,
      startedAt: new Date().toISOString(),
      source: 'backend'
    }, adminToken)

    if (!lockAcquired) {
      // 다른 프로세스가 이미 lock을 획득한 상태 → skip
      return c.json({ success: true, message: `${today} 정산이 이미 다른 프로세스에서 실행 중 또는 완료됨`, date: today, skipped: true })
    }

    // 2단계: 200ms 후 내 processId 가 그대로인지 재확인 (매우 드문 동시 요청 추가 방어)
    await new Promise(r => setTimeout(r, 200))
    const lockDoc = await fsGet(`settlements/${today}`, adminToken)
    if (lockDoc && lockDoc.fields) {
      const lockPid = fromFirestoreValue(lockDoc.fields.processId || { stringValue: '' })
      const lockStatus = fromFirestoreValue(lockDoc.fields.status || { stringValue: '' })
      if (lockStatus === 'done') {
        return c.json({ success: true, message: '이미 정산 완료 (재확인)', date: today, skipped: true })
      }
      if (lockPid !== processId) {
        return c.json({ success: true, message: '다른 프로세스가 lock 선점 (재확인)', date: today, skipped: true })
      }
    }

    // 진행중 투자 목록 조회
    const investments = await fsQuery('investments', adminToken, [], 500)
    const activeInvestments = investments.filter((inv: any) => inv.status === 'active')

    // 시스템 설정 조회 (이율 정보)
    const settings = await fsGet('settings/main', adminToken)
    const settingsData = settings?.fields ? firestoreDocToObj(settings) : {}
    
    // 추가: 4대 보너스 이율 설정 가져오기 (없으면 기본값 적용)
    const ratesDoc = await fsGet('settings/rates', adminToken)
    const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}
    const config = {
      direct1: Number(ratesData.rate_direct1 ?? 10),
      direct2: Number(ratesData.rate_direct2 ?? 5),
      rankGap: Number(ratesData.rate_rankGap ?? 1),
      override: Number(ratesData.rate_override ?? 1),
      centerFee: Number(ratesData.rate_centerFee ?? 5)
    }

    let totalPaid = 0
    let processedCount = 0
    let skippedCount = 0
    const details: any[] = []

    
    // 모든 유저 정보를 한 번에 로드 (트리 구조 추적용)
    const allUsers = await fsQuery('users', adminToken, [], 10000)
    const userMap = new Map(allUsers.map((u: any) => [u.id, u]))

    for (const inv of activeInvestments) {
      try {
        // 만료 체크
        const endDate = new Date(inv.endDate)
        if (endDate < new Date()) {
          await fsPatch(`investments/${inv.id}`, { status: 'expired' }, adminToken)
          await fireAutoRules('investment_expire', inv.userId, { productName: inv.packageName || inv.productName || '', amount: String(inv.amountUsdt || 0) }, adminToken)
          continue
        }

        // D-7 만료 예정 알림
        const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysLeft === 7) {
          await fireAutoRules('investment_expire_soon', inv.userId, { productName: inv.packageName || inv.productName || '', daysLeft: '7' }, adminToken)
        }

        // 중복 정산 방지
        if (inv.lastSettledAt) {
          const lastDate = String(inv.lastSettledAt).slice(0, 10)
          if (lastDate === today) {
            skippedCount++
            continue
          }
        }

        // 1. [데일리 수익] 계산 및 지급
        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0
        const principal = inv.amount || inv.amountUsdt || 0
        const dailyEarning = Math.round(principal * (dailyRoiPct / 100) * 1e8) / 1e8

        if (dailyEarning <= 0) continue

        // 본인 지갑 업데이트
        const wallet = await fsGet(`wallets/${inv.userId}`, adminToken)
        const wData = wallet?.fields ? firestoreDocToObj(wallet) : {}
        await fsPatch(`wallets/${inv.userId}`, {
          bonusBalance: Math.round(((wData.bonusBalance || 0) + dailyEarning) * 1e8) / 1e8,
          totalEarnings: Math.round(((wData.totalEarnings || 0) + dailyEarning) * 1e8) / 1e8
        }, adminToken)

        await fsPatch(`investments/${inv.id}`, {
          paidRoi: (inv.paidRoi || 0) + dailyEarning,
          lastSettledAt: new Date().toISOString()
        }, adminToken)

        // 데일리 수익 보너스 기록
        const dedraRate = 0.5
        await fsCreate('bonuses', {
          userId: inv.userId,
          type: 'roi',
          amount: Math.round(dailyEarning / dedraRate * 1e8) / 1e8,
          amountUsdt: dailyEarning,
          reason: `일일 데일리 수익 (${today})`,
          investmentId: inv.id,
          createdAt: new Date().toISOString()
        }, adminToken)

        await fireAutoRules('roi_claimed', inv.userId, { amount: dailyEarning.toFixed(4), date: today }, adminToken)

        totalPaid += dailyEarning
        processedCount++
        details.push({ userId: inv.userId, investmentId: inv.id, paid: dailyEarning })

        // =========================================================================
        // 4가지 엔진 코어 로직 시작
        // =========================================================================
        const sourceUser = userMap.get(inv.userId)
        if (!sourceUser) continue

        // 공통 보너스 지급 헬퍼 함수
        const payMatchingBonus = async (receiverId: string, type: string, amountUsdt: number, reason: string, level?: number) => {
          if (amountUsdt <= 0) return
          const rWalletDoc = await fsGet(`wallets/${receiverId}`, adminToken)
          const rwData = rWalletDoc?.fields ? firestoreDocToObj(rWalletDoc) : null
          if (rwData) {
            await fsPatch(`wallets/${receiverId}`, {
              bonusBalance: Math.round(((rwData.bonusBalance || 0) + amountUsdt) * 1e8) / 1e8,
              totalEarnings: Math.round(((rwData.totalEarnings || 0) + amountUsdt) * 1e8) / 1e8
            }, adminToken)
            await fsCreate('bonuses', {
              userId: receiverId,
              fromUserId: sourceUser.id,
              type,
              amount: Math.round(amountUsdt / dedraRate * 1e8) / 1e8,
              amountUsdt,
              baseIncome: dailyEarning,
              reason,
              level: level || 0,
              createdAt: new Date().toISOString()
            }, adminToken)
          }
        }

        // 2. [추천 매칭] - 1대(10%), 2대(5%)
        const upline1 = sourceUser.referredBy ? userMap.get(sourceUser.referredBy) : null
        if (upline1) {
          await payMatchingBonus(upline1.id, 'direct_bonus', dailyEarning * 0.10, `1대 추천 매칭 (기준: ${sourceUser.name})`, 1)
          
          const upline2 = upline1.referredBy ? userMap.get(upline1.referredBy) : null
          if (upline2) {
            await payMatchingBonus(upline2.id, 'direct_bonus', dailyEarning * 0.05, `2대 추천 매칭 (기준: ${sourceUser.name})`, 2)
          }
        }

        // 3. [판권 매칭 보너스] (Rank Gap Roll-up)
        let currentNode = sourceUser
        let previousRank = getRankLevel(sourceUser.rank || 'G0')
        let rollUpDepth = 1

        while (currentNode && currentNode.referredBy) {
          const parent = userMap.get(currentNode.referredBy)
          if (!parent) break

          const parentRank = getRankLevel(parent.rank || 'G0')

          // 예외 조항: 1대 직속 하급자(sourceUser)가 부모와 동급이거나 직급이 높은 경우
          if (currentNode.id === sourceUser.id && previousRank >= parentRank) {
            // 직속 하급자 본인의 데일리 수익에 대해 딱 1%만 지급 (역전/동급 예외)
            if (parentRank > 0) { // 직급이 G1 이상인 경우에만
              await payMatchingBonus(parent.id, 'rank_equal_or_higher_override_1pct', dailyEarning * 0.01, `동급/상위 직속 예외 1% (기준: ${sourceUser.name})`, rollUpDepth)
            }
            // 더 이상의 깊은 판권 매칭은 이 라인에서 올라가지 않음 (차단)
            currentNode = parent
            rollUpDepth++
            continue
          }

          // 일반 롤업 조항: 부모 직급이 현재까지 지급된 최고 직급(previousRank)보다 높을 경우
          if (parentRank > 0 && parentRank > previousRank) {
            const rankGap = parentRank - previousRank
            // 갭 1단계당 1% (rankGap / 100)
            const gapBonus = dailyEarning * (rankGap / 100)
            await payMatchingBonus(parent.id, 'rank_bonus', gapBonus, `판권 매칭 ${rankGap}% (기준: ${sourceUser.name})`, rollUpDepth)
            
            previousRank = parentRank // 최고 직급 갱신
          }

          currentNode = parent
          rollUpDepth++
        }

      } catch (e) {
        console.error("Investment processing error:", e)
      }
    }

    // // 예약 발송 자동 실행
    await processScheduledBroadcasts(adminToken)

    // 장기 미접속 / 잔액 부족 Cron 체크
    await checkInactiveUsers(adminToken)
    await checkLowBalances(adminToken)

    // 정산 기록 저장 — status를 done으로 갱신 (processing → done)
    await fsSet(`settlements/${today}`, {
      date: today,
      totalPaid,
      totalUsers: processedCount,
      skippedCount,
      details,
      status: 'done',
      source: 'cron',
      duration: Date.now() - startTime,
      startedAt: new Date().toISOString(),
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
    // 정산 중 오류 발생 시 settlements 문서를 error 상태로 업데이트
    // (다음 재시도가 가능하도록 error 상태로 표시)
    try {
      const adminToken2 = await getAdminToken()
      const today2 = overrideDate || new Date().toISOString().slice(0, 10)
      await fsPatch(`settlements/${today2}`, {
        status: 'error',
        error: e.message,
        errorAt: new Date().toISOString()
      }, adminToken2)
    } catch (_) { /* ignore secondary error */ }
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
