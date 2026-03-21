const fs = require('fs');

let indexHtml = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');
indexHtml = indexHtml.replace(
  'onclick="window.location.reload()',
  'onclick="window.hardRefresh()"'
);
fs.writeFileSync('/home/user/webapp/public/index.html', indexHtml);

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');
appJs += `
window.hardRefresh = async function() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const names = await caches.keys();
      for (let name of names) {
        await caches.delete(name);
      }
    }
  } catch (e) {
    console.error('Cache clear error:', e);
  }
  // Remove existing query params and add a timestamp
  const url = new URL(window.location.href);
  url.searchParams.set('t', new Date().getTime());
  window.location.href = url.toString();
};
`;
fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);

console.log("Patched hard refresh");
