const fs = require('fs');

const appPath = '/home/user/webapp/public/static/app.js';
let appContent = fs.readFileSync(appPath, 'utf8');

// Notice empty states
appContent = appContent.replace(
  '<div class="empty-state">공지사항이 없습니다</div>',
  '<div class="empty-state">${t(\'emptyNotice\')}</div>'
);
appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-bullhorn"></i>공지사항이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-bullhorn"></i>${t(\'emptyNotice\')}</div>'
);
appContent = appContent.replace(
  '<div class="empty-state">공지사항을 찾을 수 없습니다.</div>',
  '<div class="empty-state">${t(\'emptyNotice\')}</div>'
);
appContent = appContent.replace(
  '<div class="empty-state">불러오기 실패</div>',
  '<div class="empty-state">${t(\'loadFail\')}</div>'
);

// Transaction empty states
appContent = appContent.replace(
  '<div class="empty-state">거래 내역이 없습니다</div>',
  '<div class="empty-state">${t(\'emptyTx\')}</div>'
);
appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-receipt"></i>거래 내역이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-receipt"></i>${t(\'emptyTx\')}</div>'
);
appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-receipt"></i><br>거래 내역이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-receipt"></i><br>${t(\'emptyTx\')}</div>'
);

// Bonus empty states
appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-coins"></i>수익 내역이 없습니다<br><span style="font-size:12px;color:var(--text2);">관리자가 일일 정산을 실행하면 여기에 표시됩니다.</span></div>',
  '<div class="empty-state"><i class="fas fa-coins"></i>${t(\'emptyBonus\')}<br><span style="font-size:12px;color:var(--text2);">${t(\'emptyBonusSub\')}</span></div>'
);
appContent = appContent.replace(
  '<div class="empty-state">수익 내역을 불러오지 못했습니다.</div>',
  '<div class="empty-state">${t(\'loadFail\')}</div>'
);
appContent = appContent.replace(
  '<div class="empty-state" style="padding:20px 0;">수익 내역이 없습니다</div>',
  '<div class="empty-state" style="padding:20px 0;">${t(\'emptyBonus\')}</div>'
);

// Products empty states
appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-snowflake"></i>FREEZE 플랜이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-snowflake"></i>${t(\'emptyProducts\')}</div>'
);

// Notifications empty states
appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-bell-slash"></i><br>알림이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-bell-slash"></i><br>${t(\'emptyNoti\')}</div>'
);
appContent = appContent.replace(
  '<div class="empty-state">알림을 불러올 수 없습니다</div>',
  '<div class="empty-state">${t(\'loadFail\')}</div>'
);

// Ticket empty states
appContent = appContent.replace(
  '<div class="empty-state">문의 내역이 없습니다</div>',
  '<div class="empty-state">${t(\'emptyTicket\')}</div>'
);

// Referrals empty states
appContent = appContent.replace(
  '<div class="empty-state"><i class="fas fa-user-friends"></i>추천인이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-user-friends"></i>${t(\'emptyRef\')}</div>'
);

// Add keys
const keys = {
  ko: `
    emptyNotice: '공지사항이 없습니다',
    loadFail: '불러오기 실패',
    emptyTx: '거래 내역이 없습니다',
    emptyBonus: '수익 내역이 없습니다',
    emptyBonusSub: '관리자가 일일 정산을 실행하면 여기에 표시됩니다.',
    emptyProducts: 'FREEZE 플랜이 없습니다',
    emptyNoti: '알림이 없습니다',
    emptyTicket: '문의 내역이 없습니다',
    emptyRef: '추천인이 없습니다',
  `,
  en: `
    emptyNotice: 'No announcements',
    loadFail: 'Failed to load',
    emptyTx: 'No transaction history',
    emptyBonus: 'No earnings history',
    emptyBonusSub: 'Will be displayed here when admin runs daily settlement.',
    emptyProducts: 'No FREEZE plans available',
    emptyNoti: 'No notifications',
    emptyTicket: 'No support tickets',
    emptyRef: 'No referrals',
  `,
  vi: `
    emptyNotice: 'Không có thông báo',
    loadFail: 'Tải thất bại',
    emptyTx: 'Không có lịch sử giao dịch',
    emptyBonus: 'Không có lịch sử thu nhập',
    emptyBonusSub: 'Sẽ hiển thị ở đây khi admin chạy quyết toán hàng ngày.',
    emptyProducts: 'Không có gói FREEZE',
    emptyNoti: 'Không có thông báo',
    emptyTicket: 'Không có phiếu hỗ trợ',
    emptyRef: 'Không có người giới thiệu',
  `,
  th: `
    emptyNotice: 'ไม่มีประกาศ',
    loadFail: 'โหลดล้มเหลว',
    emptyTx: 'ไม่มีประวัติการทำธุรกรรม',
    emptyBonus: 'ไม่มีประวัติรายได้',
    emptyBonusSub: 'จะแสดงที่นี่เมื่อผู้ดูแลระบบดำเนินการสรุปยอดประจำวัน',
    emptyProducts: 'ไม่มีแผน FREEZE',
    emptyNoti: 'ไม่มีการแจ้งเตือน',
    emptyTicket: 'ไม่มีตั๋วสนับสนุน',
    emptyRef: 'ไม่มีการแนะนำ',
  `
};

for (const lang of ['ko', 'en', 'vi', 'th']) {
  const searchStr = '  ' + lang + ': {';
  const replaceStr = searchStr + '\\n' + keys[lang];
  appContent = appContent.replace(searchStr, replaceStr);
}

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('Patched all empty states');
