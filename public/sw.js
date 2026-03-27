// 캐시 삭제 및 서비스 워커 자가 파기 (캐시 완전 비활성화)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key)));
    }).then(() => {
      self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (e) => {
  // 아무것도 캐시하지 않고 네트워크로 그대로 통과
  return;
});
