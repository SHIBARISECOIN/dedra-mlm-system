const CACHE_VERSION = 'deedra-v8';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// 앱 셸(App Shell) - 오프라인에서도 반드시 필요한 파일들
const APP_SHELL = [
  '/',
  '/static/style.css',
  '/static/app.js',
  '/static/firebase.js',
  '/static/logo-banner.png',
  '/static/favicon.ico',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/js/api.js',
  '/static/js/solana-wallet.js',
  '/manifest.json',
];

// ── 설치 ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // 개별 실패를 허용하며 최대한 캐시
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => console.warn('[SW] 캐시 실패:', url))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── 활성화 ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => {
            console.log('[SW] 구버전 캐시 삭제:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

// ── 캐시 전략 판단 ────────────────────────────────────
function shouldSkipCache(url) {
  const u = new URL(url);
  return (
    u.pathname.startsWith('/api/') ||
    u.hostname.includes('firebase') ||
    u.hostname.includes('firestore') ||
    u.hostname.includes('googleapis') ||
    u.hostname.includes('gstatic') ||
    u.hostname.includes('cdn.jsdelivr') ||
    u.hostname.includes('cdnjs') ||
    u.hostname.includes('cdn.tailwindcss') ||
    u.hostname.includes('fonts.googleapis') ||
    u.hostname.includes('fonts.gstatic')
  );
}

function isStaticAsset(url) {
  const u = new URL(url);
  return (
    u.pathname.startsWith('/static/') ||
    u.pathname === '/' ||
    u.pathname === '/manifest.json' ||
    u.pathname === '/sw.js'
  );
}

// ── Fetch 핸들러 ──────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET 요청만 처리
  if (request.method !== 'GET') return;

  // API / 외부 서비스 → 캐시 없이 네트워크 직접 호출
  if (shouldSkipCache(request.url)) return;

  if (isStaticAsset(request.url)) {
    // 정적 자산: 네트워크 우선(Network-First) - 항상 최신 버전 로드
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
  } else {
    // 그 외: 네트워크 우선(Network-First), 실패 시 캐시
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

// ── 메시지 핸들러 (강제 업데이트) ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
