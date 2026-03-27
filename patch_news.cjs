const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

code = code.replace(/window\.loadNewsFeed = async function.*?};/s, `window.loadNewsFeed = async function(isRefresh = false) {
  const listEl = document.getElementById('newsFeedList');
  if (isRefresh && listEl) listEl.innerHTML = '<div class="skeleton-item" style="height:22px;margin-bottom:4px;"></div><div class="skeleton-item" style="height:22px;"></div>';
  try {
    const res = await fetch('/api/news-digest');
    const data = await res.json();
    let items = data.items || [];
    window._cachedNews = items; // save for modal
    renderNewsFeed(items, 'newsFeedList');
  } catch (err) {
    console.error('[news] load error:', err);
    if (listEl) listEl.innerHTML = \`<div class="empty-state">\${t('loadFail')}</div>\`;
  }
};`);

fs.writeFileSync('public/static/app.js', code);
console.log("Patched app.js loadNewsFeed to use /api/news-digest");
