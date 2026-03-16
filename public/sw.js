const CACHE_VERSION = 'deedra-v17';
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
  // http, https 요청만 처리 (chrome-extension 등 제외)
  if (!request.url.startsWith('http')) return;

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

// ── FCM 백그라운드 푸시 수신 ──────────────────────────────
// Firebase Messaging SDK가 firebase-messaging-sw.js를 요구하지만
// 이 프로젝트는 단일 sw.js를 사용하므로 여기서 통합 처리합니다.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
});

const messaging = firebase.messaging();

// 백그라운드 메시지 처리 (앱이 포그라운드가 아닐 때)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] 백그라운드 FCM 수신:', payload);
  const { title, body, icon, data } = payload.notification || {};
  const notifTitle = title || 'DEEDRA 알림';
  const notifOptions = {
    body: body || '',
    icon: icon || '/static/icon-192.png',
    badge: '/static/favicon.ico',
    tag: data?.tag || 'deedra-push',
    data: data || {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };
  return self.registration.showNotification(notifTitle, notifOptions);
});

// 알림 클릭 시 앱으로 포커스 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'FCM_CLICK', data: event.notification.data });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
