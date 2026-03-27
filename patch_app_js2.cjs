const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const oldCode = `    const a = snap.data();
    if (titleEl) titleEl.textContent = (a.isPinned ? '📌 ' : '📢 ') + (a.title || '제목 없음');
    if (dateEl)  dateEl.textContent  = fmtDate(a.createdAt);
    if (bodyEl)  bodyEl.innerHTML    = \`<div class="ann-detail-content">\${(a.content || '내용 없음').replace(/\\n/g, '<br>')}</div>\`;`;

const newCode = `    const a = snap.data();
    const title = (currentLang !== 'ko' && a['title_' + currentLang]) ? a['title_' + currentLang] : a.title;
    const content = (currentLang !== 'ko' && a['content_' + currentLang]) ? a['content_' + currentLang] : a.content;
    if (titleEl) titleEl.textContent = (a.isPinned ? '📌 ' : '📢 ') + (title || '제목 없음');
    if (dateEl)  dateEl.textContent  = fmtDate(a.createdAt);
    if (bodyEl)  bodyEl.innerHTML    = \`<div class="ann-detail-content">\${(content || '내용 없음').replace(/\\n/g, '<br>')}</div>\`;`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('public/static/app.js', code);
  console.log('Patched showAnnouncementDetail successfully.');
} else {
  console.log('Could not find exact string.');
}
