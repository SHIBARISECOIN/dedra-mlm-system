const fs = require('fs');

// 1. Rewrite sw.js to self-destruct and clear caches
const swCode = `// 캐시 삭제 및 서비스 워커 자가 파기 (캐시 완전 비활성화)
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
`;
fs.writeFileSync('/home/user/webapp/public/sw.js', swCode);
console.log("Updated sw.js to self-destruct.");

// 2. Modify app.js to unregister service worker instead of registering
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');
const registerCode = `navigator.serviceWorker.register('/sw.js').then((reg) => {`;
const unregisterCode = `navigator.serviceWorker.getRegistrations().then((regs) => {
      for (let reg of regs) { reg.unregister(); }
      console.log('[SW] 캐시 비활성화를 위해 서비스워커 등록 해제됨');
    }).catch(e => {`;

if (appJs.includes(registerCode)) {
  appJs = appJs.replace(registerCode, unregisterCode);
  fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
  console.log("Updated app.js to unregister service worker.");
} else {
  console.log("Could not find SW register code in app.js.");
}

// 3. Add no-cache meta tags to index.html if not present
let indexHtml = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');
if (!indexHtml.includes('no-cache')) {
  const metaTags = `
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">`;
  
  indexHtml = indexHtml.replace('<head>', `<head>${metaTags}`);
  fs.writeFileSync('/home/user/webapp/public/index.html', indexHtml);
  console.log("Added no-cache meta tags to index.html.");
} else {
  console.log("index.html already has no-cache meta tags.");
}

// 4. Also bust app.js cache one last time
const ts = Date.now();
indexHtml = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');
indexHtml = indexHtml.replace(/\/static\/app\.js\?v=\d+/g, `/static/app.js?v=${ts}`);
fs.writeFileSync('/home/user/webapp/public/index.html', indexHtml);
console.log("Busted cache in index.html with ts: " + ts);

