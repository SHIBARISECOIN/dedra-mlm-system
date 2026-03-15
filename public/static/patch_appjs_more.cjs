const fs = require('fs');

const appJsPath = '/home/user/webapp/public/static/app.js';
let appContent = fs.readFileSync(appJsPath, 'utf8');

// Replace dynamic texts in app.js using simple string replacement instead of complex regexes
appContent = appContent.replace(
  "setEl('nepSubTitle', `하부 ${totalMembers}명 조직 수익 현황`);", 
  "setEl('nepSubTitle', t('orgTitle').replace('{n}', totalMembers));"
);

appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-user-friends"></i><br>${gen}대 하부 멤버가 없습니다</div>', 
  '<div class="empty-state"><i class="fas fa-user-friends"></i><br>${t(\'emptySubGen\').replace(\'{gen}\', gen)}</div>'
);

appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-network-wired"></i><br>3대 이하 하부 멤버가 없습니다</div>', 
  '<div class="empty-state"><i class="fas fa-network-wired"></i><br>${t(\'emptyDeepGen\')}</div>'
);

appContent = appContent.replace(
  '<div style="font-size:13px;font-weight:700;color:var(--text,#f1f5f9);">${g}대 하부</div>', 
  '<div style="font-size:13px;font-weight:700;color:var(--text,#f1f5f9);">${t(\'genSub\').replace(\'{gen}\', g)}</div>'
);

// 하부 {n}명 · 당일 ${fmt(totalEarn)}
appContent = appContent.replace(
  '<div style="font-size:12px;color:var(--text2,#94a3b8);margin-top:2px;">하부 ${count}명 · 당일 $${fmt(today)}</div>', 
  '<div style="font-size:12px;color:var(--text2,#94a3b8);margin-top:2px;">${t(\'subMembers\')} ${count} · ${t(\'todayEarn\')} $${fmt(today)}</div>'
);

appContent = appContent.replace(
  '<div style="font-size:11px;color:var(--text2,#94a3b8);margin-top:4px;">${tierName} · 하부 ${myRefs}명</div>', 
  '<div style="font-size:11px;color:var(--text2,#94a3b8);margin-top:4px;">${tierName} · ${t(\'subMembers\')} ${myRefs}</div>'
);

fs.writeFileSync(appJsPath, appContent, 'utf8');

// index.html replacements
const indexPath = '/home/user/webapp/public/index.html';
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(
  '👤 1대 조직</button>',
  '<span data-i18n="tabGen1">1대 조직</span></button>'
);
indexContent = indexContent.replace(
  '👥 2대 조직</button>',
  '<span data-i18n="tabGen2">2대 조직</span></button>'
);
indexContent = indexContent.replace(
  '🌐 산하 조직</button>',
  '<span data-i18n="tabDeep">산하 조직</span></button>'
);
indexContent = indexContent.replace(
  '💳 거래내역</button>',
  '<span data-i18n="tabTx">거래내역</span></button>'
);

fs.writeFileSync(indexPath, indexContent, 'utf8');

console.log('Patched dynamic labels in JS and HTML');
