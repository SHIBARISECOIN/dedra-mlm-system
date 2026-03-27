const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `function renderNewsFeed(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = \`<div class="empty-state">\${t('emptyNews') || '등록된 뉴스가 없습니다'}</div>\`;
    return;
  }

  const isHome = (containerId === 'newsFeedList');
  const displayItems = isHome ? items.slice(0, 3) : items;

  el.innerHTML = displayItems.map((n, idx) => {
    let title = n.title;
    if (currentLang && currentLang !== 'ko' && n['title_' + currentLang]) {
      title = n['title_' + currentLang];
    }
    
    let source = '소식통';
    if (currentLang === 'en') source = 'News';
    if (currentLang === 'vi') source = 'Tin tức';
    if (currentLang === 'th') source = 'ข่าว';
    
    let dateStr = '';
    try {
      if (n.pubDate) {
        const d = new Date(n.pubDate);
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        dateStr = \`\${mo}/\${dy}\`;
      }
    } catch (e) {}

    const thumbHtml = \`<div class="news-feed-thumb-placeholder">📰</div>\`;

    return \`
      <div onclick="showNewsModal()" style="cursor:pointer;" class="news-feed-item">
        \${thumbHtml}
        <div class="news-feed-body">
          <div class="news-feed-source">\${source}</div>
          <div class="news-feed-title">\${title}</div>
          <div class="news-feed-date">\${dateStr}</div>
        </div>
      </div>
    \`;
  }).join('');
}`;

const replace = `function renderNewsFeed(items, containerId) {
  try {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!Array.isArray(items) || items.length === 0) {
      el.innerHTML = \`<div class="empty-state">\${t('emptyNews') || '등록된 뉴스가 없습니다'}</div>\`;
      return;
    }

    const isHome = (containerId === 'newsFeedList');
    const displayItems = isHome ? items.slice(0, 3) : items;

    el.innerHTML = displayItems.map((n, idx) => {
      let title = n.title || 'Untitled';
      try {
        if (typeof currentLang !== 'undefined' && currentLang !== 'ko' && n['title_' + currentLang]) {
          title = n['title_' + currentLang];
        }
      } catch(e) {}
      
      let source = '소식통';
      try {
        if (typeof currentLang !== 'undefined') {
          if (currentLang === 'en') source = 'News';
          if (currentLang === 'vi') source = 'Tin tức';
          if (currentLang === 'th') source = 'ข่าว';
        }
      } catch(e) {}
      
      let dateStr = '';
      try {
        if (n.pubDate) {
          const d = new Date(n.pubDate);
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          dateStr = \`\${mo}/\${dy}\`;
        }
      } catch (e) {}

      const thumbHtml = \`<div class="news-feed-thumb-placeholder">📰</div>\`;

      return \`
        <div onclick="showNewsModal()" style="cursor:pointer;" class="news-feed-item">
          \${thumbHtml}
          <div class="news-feed-body">
            <div class="news-feed-source">\${source}</div>
            <div class="news-feed-title">\${title}</div>
            <div class="news-feed-date">\${dateStr}</div>
          </div>
        </div>
      \`;
    }).join('');
  } catch (err) {
    console.error("renderNewsFeed Error:", err);
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = \`<div class="empty-state">Render Error: \${err.message}</div>\`;
  }
}`;

code = code.replace(target, replace);
fs.writeFileSync('public/static/app.js', code);
