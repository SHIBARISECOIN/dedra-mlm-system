const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// Patch renderAnnouncements
code = code.replace(
  /el\.innerHTML = items\.map\(a => `\s*<div class="announcement-item" onclick="showAnnouncementDetail\('\${a\.id}'\)">\s*<div class="ann-title">\s*\$\{a\.isPinned \? `<span class="pin-badge">\$\{t\('noticePinBadge'\) \|\| '공지'\}<\/span>` : ''\}\$\{a\.title \|\| '제목 없음'\}\s*<\/div>\s*<div class="ann-date">\$\{fmtDate\(a\.createdAt\)\}<\/div>\s*<\/div>\s*`\)\.join\(''\);/,
  `const getTrans = (obj, field) => (currentLang !== 'ko' && obj[field + '_' + currentLang]) ? obj[field + '_' + currentLang] : obj[field];
  el.innerHTML = items.map(a => \`
    <div class="announcement-item" onclick="showAnnouncementDetail('\${a.id}')">
      <div class="ann-title">
        \${a.isPinned ? \`<span class="pin-badge">\${t('noticePinBadge') || '공지'}</span>\` : ''}\${getTrans(a, 'title') || '제목 없음'}
      </div>
      <div class="ann-date">\${fmtDate(a.createdAt)}</div>
    </div>
  \`).join('');`
);

// Patch showAnnouncementDetail
code = code.replace(
  /const a = snap\.data\(\);\s*if \(titleEl\) titleEl\.textContent = \(a\.isPinned \? '📌 ' : '📢 '\) \+ \(a\.title \|\| '제목 없음'\);\s*if \(dateEl\)  dateEl\.textContent  = fmtDate\(a\.createdAt\);\s*if \(bodyEl\)  bodyEl\.innerHTML    = `<div class="ann-detail-content">\$\{\(a\.content \|\| '내용 없음'\)\.replace\(\/\\\\n\/g, '<br>'\)\}<\/div>`;/,
  `const a = snap.data();
    const title = (currentLang !== 'ko' && a['title_' + currentLang]) ? a['title_' + currentLang] : a.title;
    const content = (currentLang !== 'ko' && a['content_' + currentLang]) ? a['content_' + currentLang] : a.content;
    if (titleEl) titleEl.textContent = (a.isPinned ? '📌 ' : '📢 ') + (title || '제목 없음');
    if (dateEl)  dateEl.textContent  = fmtDate(a.createdAt);
    if (bodyEl)  bodyEl.innerHTML    = \`<div class="ann-detail-content">\${(content || '내용 없음').replace(/\\n/g, '<br>')}</div>\`;`
);

fs.writeFileSync('public/static/app.js', code);
console.log('public/static/app.js updated');
