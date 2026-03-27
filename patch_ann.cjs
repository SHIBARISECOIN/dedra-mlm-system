const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const targetStr = `  } catch (err) {
    console.error('[announcements] load error:', err);
    const el = document.getElementById('announcementList');
    if (el) el.innerHTML = \`<div class="empty-state">\\${t('emptyNotice')}</div>\`;
  }`;

const injection = `  } catch (err) {
    console.error('[announcements] load error:', err);
    // Silent fail fallback to normal empty state
    const el = document.getElementById('announcementList');
    if (el) el.innerHTML = \`<div class="empty-state">\\${t('emptyNotice')}</div>\`;
  }`;

// appJs = appJs.replace(targetStr, injection);
// fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log('No patch needed, just checking');
