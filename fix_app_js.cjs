const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// I'll use string replacement based on markers if possible, or just a very clear regex.
// Wait, since I know the exact broken part, let's just replace it.
const brokenPart = `window.loadNewsFeed = async function(isRefresh = false) {
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
};
    });
    window._cachedNews = items; // save for modal
    renderNewsFeed(items, 'newsFeedList');
  } catch (err) {
    console.error('[news] load error:', err);
    if (listEl) listEl.innerHTML = \`<div class="empty-state">\${t('loadFail')}</div>\`;
  }
};`;

const fixedPart = `window.loadNewsFeed = async function(isRefresh = false) {
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

if(code.includes(brokenPart)) {
    code = code.replace(brokenPart, fixedPart);
    fs.writeFileSync('public/static/app.js', code);
    console.log("Fixed app.js successfully by exact string replacement.");
} else {
    console.log("Could not find the exact broken part. Let's do a regex fix.");
    // broader fix
    code = code.replace(/window\.loadNewsFeed = async function\(isRefresh = false\) \{[\s\S]*?\}\;\n    \}\);\n[\s\S]*?\}\;/m, fixedPart);
    fs.writeFileSync('public/static/app.js', code);
    console.log("Fixed by regex.");
}
