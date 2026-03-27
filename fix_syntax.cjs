const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const regex = /window\.loadNewsFeed = async function\(isRefresh = false\) \{[\s\S]*?\}\;\n    \}\);\n    window\._cachedNews = items; \/\/ save for modal\n    renderNewsFeed\(items, 'newsFeedList'\);\n  \} catch \(err\) \{\n    console\.error\('\[news\] load error:', err\);\n    if \(listEl\) listEl\.innerHTML = `<div class="empty-state">\$\{t\('loadFail'\)\}<\/div>`;\n  \}\n\};/m;

const correctCode = `window.loadNewsFeed = async function(isRefresh = false) {
  const listEl = document.getElementById('newsFeedList');
  if (isRefresh && listEl) listEl.innerHTML = '<div class="skeleton-item" style="height:22px;margin-bottom:4px;"></div><div class="skeleton-item" style="height:22px;"></div>';
  try {
    if (!window.FB) { throw new Error("FB not ready"); }
    const { collection, getDocs, db, query, orderBy, limit } = window.FB;
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(10));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || '',
        title_en: data.title_en || '',
        title_vi: data.title_vi || '',
        title_th: data.title_th || '',
        description: data.summary || data.content || '',
        description_en: data.summary_en || data.content_en || '',
        description_vi: data.summary_vi || data.content_vi || '',
        description_th: data.summary_th || data.content_th || '',
        link: data.sourceUrl || '#',
        pubDate: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      };
    });
    window._cachedNews = items; // save for modal
    renderNewsFeed(items, 'newsFeedList');
  } catch (err) {
    console.error('[news] load error:', err);
    if (listEl) listEl.innerHTML = \`<div class="empty-state">\${t('loadFail')}</div>\`;
  }
};`;

// Let's just find where window.loadNewsFeed starts and replace the whole block until the duplicated catch block
const idxStart = code.indexOf('window.loadNewsFeed = async function');
const nextFuncIdx = code.indexOf('window.showNewsModal = function', idxStart);

if (idxStart !== -1 && nextFuncIdx !== -1) {
    code = code.substring(0, idxStart) + correctCode + '\n\n' + code.substring(nextFuncIdx);
    fs.writeFileSync('public/static/app.js', code);
    console.log('Fixed syntax error!');
} else {
    console.log('Could not find start or end index');
}

