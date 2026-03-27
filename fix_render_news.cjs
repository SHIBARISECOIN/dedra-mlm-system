const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const regex = /function renderNewsFeed\([\s\S]*?\}\n\n\/\/ ===== 모달 =====/m;
const match = code.match(regex);
if (!match) {
    console.log("Could not find renderNewsFeed!");
} else {
    const replacement = `function renderNewsFeed(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = \`<div class="empty-state">\${t('emptyNotice') || '등록된 뉴스가 없습니다'}</div>\`;
    return;
  }

  const isHome = (containerId === 'newsFeedList');
  const displayItems = isHome ? items.slice(0, 3) : items;

  el.innerHTML = displayItems.map((n, idx) => {
    let title = n.title;
    if (window.currentLang && window.currentLang !== 'ko' && n['title_' + window.currentLang]) {
      title = n['title_' + window.currentLang];
    }
    
    let source = '소식통';
    if (window.currentLang === 'en') source = 'News';
    if (window.currentLang === 'vi') source = 'Tin tức';
    if (window.currentLang === 'th') source = 'ข่าว';
    
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
}

// ===== 모달 =====`;
    code = code.replace(regex, replacement);
}

const regexModal = /window\.showNewsModal = function\(\) \{[\s\S]*?\}\;\n\nfunction renderNewsFeed/m;
const matchModal = code.match(regexModal);
if (!matchModal) {
    console.log("Could not find showNewsModal!");
} else {
    const replacementModal = `window.showNewsModal = function() {
  const modal = document.getElementById('newsModal');
  if (modal) modal.classList.remove('hidden');
  
  const el = document.getElementById('newsFullList');
  if (!el) return;
  
  const items = window._cachedNews || [];
  if (!items || !items.length) {
    el.innerHTML = \`<div class="empty-state">\${t('emptyNotice') || '등록된 뉴스가 없습니다'}</div>\`;
    return;
  }
  
  el.innerHTML = items.map((n, idx) => {
    let dateStr = '';
    try {
        dateStr = n.pubDate ? new Date(n.pubDate).toLocaleDateString() : '';
    } catch(e) {}
    
    let title = n.title;
    if (window.currentLang && window.currentLang !== 'ko' && n['title_' + window.currentLang]) {
      title = n['title_' + window.currentLang];
    }
    
    let desc = n.description || '';
    if (window.currentLang && window.currentLang !== 'ko' && n['description_' + window.currentLang]) {
      desc = n['description_' + window.currentLang];
    }

    let source = '소식통';
    if (window.currentLang === 'en') source = 'News';
    if (window.currentLang === 'vi') source = 'Tin tức';
    if (window.currentLang === 'th') source = 'ข่าว';

    return \`
      <div class="news-feed-item" style="display:block; padding:16px; margin-bottom:12px; border-bottom:1px solid var(--border);">
        <div style="font-size:11px; color:var(--accent); font-weight:700; margin-bottom:4px;">📰 \${source} (Daily Digest)</div>
        <div style="font-size:14px; font-weight:800; color:var(--text); margin-bottom:8px; line-height:1.4;">\${title}</div>
        <div style="font-size:12px; color:var(--text2); line-height:1.5; margin-bottom:10px;">\${desc}</div>
        <div style="font-size:11px; color:var(--text3); display:flex; justify-content:space-between;">
          <span>\${dateStr}</span>
          <a href="\${n.link || '#'}" target="_blank" style="color:var(--blue); text-decoration:none;">원문 보기 &rarr;</a>
        </div>
      </div>
    \`;
  }).join('');
};

function renderNewsFeed`;
    code = code.replace(regexModal, replacementModal);
}

fs.writeFileSync('public/static/app.js', code);
console.log('patched render methods');
