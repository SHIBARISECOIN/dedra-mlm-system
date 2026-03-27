const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// Add emptyNews to en
code = code.replace(/emptyNotice:\s*'No announcements',/g, "emptyNotice: 'No announcements',\n    emptyNews: 'No news available',");
code = code.replace(/emptyNotice:\s*'Announcement not found\.',/g, "emptyNotice: 'Announcement not found.',\n    emptyNews: 'No news available.',");

// Add emptyNews to ko
code = code.replace(/emptyNotice:\s*'공지사항이 없습니다',/g, "emptyNotice: '공지사항이 없습니다',\n    emptyNews: '등록된 뉴스가 없습니다',");
code = code.replace(/emptyNotice:\s*'공지사항을 찾을 수 없습니다\.',/g, "emptyNotice: '공지사항을 찾을 수 없습니다.',\n    emptyNews: '등록된 뉴스를 찾을 수 없습니다.',");

// Add emptyNews to vi
code = code.replace(/emptyNotice:\s*'Không có thông báo',/g, "emptyNotice: 'Không có thông báo',\n    emptyNews: 'Không có tin tức nào',");
code = code.replace(/emptyNotice:\s*'Không tìm thấy thông báo\.',/g, "emptyNotice: 'Không tìm thấy thông báo.',\n    emptyNews: 'Không tìm thấy tin tức nào.',");

// Add emptyNews to th
code = code.replace(/emptyNotice:\s*'ไม่มีประกาศ',/g, "emptyNotice: 'ไม่มีประกาศ',\n    emptyNews: 'ไม่มีข่าวสาร',");
code = code.replace(/emptyNotice:\s*'ไม่พบประกาศ',/g, "emptyNotice: 'ไม่พบประกาศ',\n    emptyNews: 'ไม่พบข่าวสาร',");

// Replace in render methods
code = code.replace(/t\('emptyNotice'\) \|\| '등록된 뉴스가 없습니다'/g, "t('emptyNews') || '등록된 뉴스가 없습니다'");

fs.writeFileSync('public/static/app.js', code);
console.log('patched news i18n');
