const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `window.loadNewsFeed = async function(isRefresh = false) {
  console.log("=== LOAD NEWS FEED CALLED ===");
  alert("LOAD NEWS FEED CALLED");
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
};`;

const replace = `window.loadNewsFeed = async function(isRefresh = false) {
  try {
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
  } catch(e) {
    alert("News Error: " + e.message + "\\n" + e.stack);
  }
};`;

code = code.replace(target, replace);
fs.writeFileSync('public/static/app.js', code);
