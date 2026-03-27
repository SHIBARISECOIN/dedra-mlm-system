const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `window.showNewsModal = function() {
  const modal = document.getElementById('newsModal');
  if (modal) modal.classList.remove('hidden');
  
  const el = document.getElementById('newsFullList');
  if (!el) return;
  
  const items = window._cachedNews || [];
  if (!items || !items.length) {
    el.innerHTML = \`<div class="empty-state">\${t('emptyNews') || '등록된 뉴스가 없습니다'}</div>\`;
    return;
  }
  
  el.innerHTML = items.map((n, idx) => {
    let dateStr = '';
    try {
        dateStr = n.pubDate ? new Date(n.pubDate).toLocaleDateString() : '';
    } catch(e) {}
    
    let title = n.title;
    if (currentLang && currentLang !== 'ko' && n['title_' + currentLang]) {
      title = n['title_' + currentLang];
    }
    
    let desc = n.description || '';
    if (currentLang && currentLang !== 'ko' && n['description_' + currentLang]) {
      desc = n['description_' + currentLang];
    }

    let source = '소식통';
    if (currentLang === 'en') source = 'News';
    if (currentLang === 'vi') source = 'Tin tức';
    if (currentLang === 'th') source = 'ข่าว';

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
};`;

const replace = `window.showNewsModal = function() {
  try {
    const modal = document.getElementById('newsModal');
    if (modal) modal.classList.remove('hidden');
    
    const el = document.getElementById('newsFullList');
    if (!el) return;
    
    const items = window._cachedNews || [];
    if (!Array.isArray(items) || items.length === 0) {
      el.innerHTML = \`<div class="empty-state">\${t('emptyNews') || '등록된 뉴스가 없습니다'}</div>\`;
      return;
    }
    
    el.innerHTML = items.map((n, idx) => {
      let dateStr = '';
      try {
          dateStr = n.pubDate ? new Date(n.pubDate).toLocaleDateString() : '';
      } catch(e) {}
      
      let title = n.title || 'Untitled';
      try {
        if (typeof currentLang !== 'undefined' && currentLang !== 'ko' && n['title_' + currentLang]) {
          title = n['title_' + currentLang];
        }
      } catch(e) {}
      
      let desc = n.description || '';
      try {
        if (typeof currentLang !== 'undefined' && currentLang !== 'ko' && n['description_' + currentLang]) {
          desc = n['description_' + currentLang];
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
  } catch (err) {
    console.error("showNewsModal Error:", err);
  }
};`;

code = code.replace(target, replace);
fs.writeFileSync('public/static/app.js', code);
