const fs = require('fs');

const appPath = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(appPath, 'utf8');

const keys = {
  ko: `
    diceHint: '숫자를 선택하여 베팅하세요',
    earnSeeAll: '수익 전체보기',
    freezingNow: '❄️ 진행중',
    gameStartHint: '칩을 선택하여 베팅하세요',
    labelCountry: '국가',
    netPerfAll: '산하 조직 실적',
    netPerfGen1: '1대 조직 실적',
    netPerfGen2: '2대 조직 실적',
    networkDetail: '조직 상세',
    networkEarnings: '네트워크 수익',
    playWithEarn: '수익으로 즉시 플레이',
    rank_next_label: '다음 직급:',
    rank_referral: '추천인',
    rank_referral_unit: '명',
    subMembers: '하부 인원',
    todayEarn: '당일 수익',
    todayEarnLabel: '오늘 수익',
    todayEarnSummary: 'TODAY 당일 수익 요약',
    totalEarnSum: '전체 당일 수익 합계',
    totalEarnings: '누적 수익',
    totalSubMembersEarn: '총 하부 인원 · 누적 수익',
    viewDetail: '상세보기 ›',
    withdrawNoticeText: '※ 처리 완료까지 1-3일 소요',
    withdrawableDdra: '출금 가능 DDRA',
    withdrawableDdraLabel: '출금 가능 DDRA',
    tabGen1: '1대 조직',
    tabGen2: '2대 조직',
    tabDeep: '산하 조직',
    tabTx: '거래내역',
    emptySubGen: '{gen}대 하부 멤버가 없습니다',
    emptyDeepGen: '3대 이하 하부 멤버가 없습니다',
    genSub: '{gen}대 하부',
    orgTitle: '하부 {n}명 조직 수익 현황',
    myInvestTitle: '📋 내 FREEZE 현황',
    emptyInvest: '진행 중인 FREEZE가 없습니다',
    dailyReturnLabel: '❄️ 일 수익:',
    remainDaysLabel: '잔여 {n}일',
    totalExpectedLabel: '총 예상수익(일): +{n} USDT (원금은 만기 후 출금 가능)',
    investUnit: '건',
    perDay: '/일',
    productMonth1: '1개월',
    productMonth3: '3개월',
    productMonth6: '6개월',
    productMonth12: '12개월',
    productHint1: '{min} USDT FREEZE 시 일 수익',
    productHint2: '만기 후 언프리즈 가능',
    ddraConvert: 'DDRA 환산',
    maturityDate: '만기일',
    emptyNotice: '공지사항이 없습니다',
    loadFail: '불러오기 실패',
    emptyTx: '거래 내역이 없습니다',
    emptyBonus: '수익 내역이 없습니다',
    emptyBonusSub: '관리자가 일일 정산을 실행하면 여기에 표시됩니다.',
    emptyProducts: 'FREEZE 플랜이 없습니다',
    emptyNoti: '알림이 없습니다',
    emptyTicket: '문의 내역이 없습니다',
    emptyRef: '추천인이 없습니다',
    notiTitleMature: '✅ FREEZE 만기 완료',
    notiMsgMature: '[{name}] FREEZE 계약이 만료되었습니다. 원금 {amt} USDT가 지갑에 언프리즈되었습니다.',
    toastMature: '❄️ 만기 FREEZE {n}건의 원금이 언프리즈되었습니다.',
  `,
  en: `
    diceHint: 'Select a number to bet',
    earnSeeAll: 'See All Earnings',
    freezingNow: '❄️ Freezing',
    gameStartHint: 'Select chips to bet',
    labelCountry: 'Country',
    netPerfAll: 'Total Org Perf.',
    netPerfGen1: 'Gen1 Perf.',
    netPerfGen2: 'Gen2 Perf.',
    networkDetail: 'Network Detail',
    networkEarnings: 'Network Earnings',
    playWithEarn: 'Play with Earnings',
    rank_next_label: 'Next Rank:',
    rank_referral: 'Referrals',
    rank_referral_unit: ' members',
    subMembers: 'Sub Members',
    todayEarn: 'Today Earn',
    todayEarnLabel: 'Today Earn',
    todayEarnSummary: 'TODAY Earnings Summary',
    totalEarnSum: 'Total Earnings Sum',
    totalEarnings: 'Total Earnings',
    totalSubMembersEarn: 'Total Sub Members & Earn',
    viewDetail: 'Details ›',
    withdrawNoticeText: '※ 1-3 days for processing',
    withdrawableDdra: 'Withdrawable DDRA',
    withdrawableDdraLabel: 'Withdrawable DDRA',
    tabGen1: 'Gen 1',
    tabGen2: 'Gen 2',
    tabDeep: 'Deep Org',
    tabTx: 'Transactions',
    emptySubGen: 'No sub-members in Gen {gen}',
    emptyDeepGen: 'No sub-members in Gen 3+',
    genSub: 'Gen {gen}',
    orgTitle: 'Org Perf. ({n} members)',
    myInvestTitle: '📋 My FREEZE',
    emptyInvest: 'No active FREEZE found',
    dailyReturnLabel: '❄️ Daily Return:',
    remainDaysLabel: '{n} days left',
    totalExpectedLabel: 'Total Expected/Day: +{n} USDT (Principal withdrawable at maturity)',
    investUnit: ' items',
    perDay: '/day',
    productMonth1: '1 Month',
    productMonth3: '3 Months',
    productMonth6: '6 Months',
    productMonth12: '12 Months',
    productHint1: 'Daily return for {min} USDT FREEZE',
    productHint2: 'Principal unlockable after maturity',
    ddraConvert: 'DDRA Conv.',
    maturityDate: 'Maturity Date',
    emptyNotice: 'No announcements',
    loadFail: 'Failed to load',
    emptyTx: 'No transaction history',
    emptyBonus: 'No earnings history',
    emptyBonusSub: 'Will be displayed here when admin runs daily settlement.',
    emptyProducts: 'No FREEZE plans available',
    emptyNoti: 'No notifications',
    emptyTicket: 'No support tickets',
    emptyRef: 'No referrals',
    notiTitleMature: '✅ FREEZE Matured',
    notiMsgMature: '[{name}] FREEZE contract has matured. Principal {amt} USDT has been unfrozen to your wallet.',
    toastMature: '❄️ {n} matured FREEZE principals have been unfrozen.',
  `,
  vi: `
    diceHint: 'Chọn một số để cược',
    earnSeeAll: 'Xem tất cả',
    freezingNow: '❄️ Đang đóng băng',
    gameStartHint: 'Chọn chip để cược',
    labelCountry: 'Quốc gia',
    netPerfAll: 'Thành tích toàn bộ',
    netPerfGen1: 'Thành tích F1',
    netPerfGen2: 'Thành tích F2',
    networkDetail: 'Chi tiết mạng lưới',
    networkEarnings: 'Thu nhập mạng lưới',
    playWithEarn: 'Chơi bằng Thu nhập',
    rank_next_label: 'Hạng tiếp theo:',
    rank_referral: 'Giới thiệu',
    rank_referral_unit: ' TV',
    subMembers: 'TV cấp dưới',
    todayEarn: 'Thu nhập HN',
    todayEarnLabel: 'Thu nhập Hôm nay',
    todayEarnSummary: 'Tóm tắt thu nhập HÔM NAY',
    totalEarnSum: 'Tổng thu nhập',
    totalEarnings: 'Tổng thu nhập',
    totalSubMembersEarn: 'Tổng TV & Thu nhập',
    viewDetail: 'Chi tiết ›',
    withdrawNoticeText: '※ Xử lý trong 1-3 ngày',
    withdrawableDdra: 'DDRA có thể rút',
    withdrawableDdraLabel: 'DDRA có thể rút',
    tabGen1: 'Thế hệ 1',
    tabGen2: 'Thế hệ 2',
    tabDeep: 'Mạng lưới',
    tabTx: 'Giao dịch',
    emptySubGen: 'Không có thành viên ở F{gen}',
    emptyDeepGen: 'Không có thành viên ở F3+',
    genSub: 'F{gen}',
    orgTitle: 'Thành tích lưới ({n} TV)',
    myInvestTitle: '📋 Đầu tư của tôi',
    emptyInvest: 'Không có FREEZE nào đang hoạt động',
    dailyReturnLabel: '❄️ Lợi nhuận hàng ngày:',
    remainDaysLabel: 'Còn lại {n} ngày',
    totalExpectedLabel: 'Tổng dự kiến/ngày: +{n} USDT (Gốc có thể rút khi đáo hạn)',
    investUnit: ' mục',
    perDay: '/ngày',
    productMonth1: '1 Tháng',
    productMonth3: '3 Tháng',
    productMonth6: '6 Tháng',
    productMonth12: '12 Tháng',
    productHint1: 'Lợi nhuận hàng ngày với {min} USDT FREEZE',
    productHint2: 'Gốc có thể rút sau khi đáo hạn',
    ddraConvert: 'Quy đổi DDRA',
    maturityDate: 'Ngày đáo hạn',
    emptyNotice: 'Không có thông báo',
    loadFail: 'Tải thất bại',
    emptyTx: 'Không có lịch sử giao dịch',
    emptyBonus: 'Không có lịch sử thu nhập',
    emptyBonusSub: 'Sẽ hiển thị ở đây khi admin chạy quyết toán hàng ngày.',
    emptyProducts: 'Không có gói FREEZE',
    emptyNoti: 'Không có thông báo',
    emptyTicket: 'Không có phiếu hỗ trợ',
    emptyRef: 'Không có người giới thiệu',
    notiTitleMature: '✅ FREEZE Đáo hạn',
    notiMsgMature: '[{name}] Hợp đồng FREEZE đã đáo hạn. Gốc {amt} USDT đã được hoàn lại vào ví.',
    toastMature: '❄️ {n} khoản gốc FREEZE đáo hạn đã được hoàn lại.',
  `,
  th: `
    diceHint: 'เลือกหมายเลขเพื่อเดิมพัน',
    earnSeeAll: 'ดูรายได้ทั้งหมด',
    freezingNow: '❄️ กำลังแช่แข็ง',
    gameStartHint: 'เลือกชิปเพื่อเดิมพัน',
    labelCountry: 'ประเทศ',
    netPerfAll: 'ผลงานองค์กรทั้งหมด',
    netPerfGen1: 'ผลงาน G1',
    netPerfGen2: 'ผลงาน G2',
    networkDetail: 'รายละเอียดเครือข่าย',
    networkEarnings: 'รายได้เครือข่าย',
    playWithEarn: 'เล่นด้วยรายได้',
    rank_next_label: 'ตำแหน่งถัดไป:',
    rank_referral: 'แนะนำ',
    rank_referral_unit: ' คน',
    subMembers: 'สมาชิกระดับล่าง',
    todayEarn: 'รายได้วันนี้',
    todayEarnLabel: 'รายได้วันนี้',
    todayEarnSummary: 'สรุปรายได้วันนี้',
    totalEarnSum: 'ยอดรวมรายได้ทั้งหมด',
    totalEarnings: 'รายได้สะสม',
    totalSubMembersEarn: 'สมาชิกย่อยทั้งหมด & รายได้',
    viewDetail: 'รายละเอียด ›',
    withdrawNoticeText: '※ ใช้เวลาดำเนินการ 1-3 วัน',
    withdrawableDdra: 'DDRA ที่ถอนได้',
    withdrawableDdraLabel: 'DDRA ที่ถอนได้',
    tabGen1: 'รุ่นที่ 1',
    tabGen2: 'รุ่นที่ 2',
    tabDeep: 'องค์กรลึก',
    tabTx: 'ธุรกรรม',
    emptySubGen: 'ไม่มีสมาชิกในรุ่น {gen}',
    emptyDeepGen: 'ไม่มีสมาชิกในรุ่น 3+',
    genSub: 'รุ่น {gen}',
    orgTitle: 'ผลงานองค์กร (สมาชิก {n})',
    myInvestTitle: '📋 การลงทุนของฉัน',
    emptyInvest: 'ไม่พบ FREEZE ที่กำลังใช้งาน',
    dailyReturnLabel: '❄️ ผลตอบแทนรายวัน:',
    remainDaysLabel: 'เหลือ {n} วัน',
    totalExpectedLabel: 'คาดการณ์รวม/วัน: +{n} USDT (ถอนเงินต้นได้เมื่อครบกำหนด)',
    investUnit: ' รายการ',
    perDay: '/วัน',
    productMonth1: '1 เดือน',
    productMonth3: '3 เดือน',
    productMonth6: '6 เดือน',
    productMonth12: '12 เดือน',
    productHint1: 'ผลตอบแทนรายวันสำหรับ FREEZE {min} USDT',
    productHint2: 'เงินต้นสามารถถอนได้เมื่อครบกำหนด',
    ddraConvert: 'แปลงเป็น DDRA',
    maturityDate: 'วันครบกำหนด',
    emptyNotice: 'ไม่มีประกาศ',
    loadFail: 'โหลดล้มเหลว',
    emptyTx: 'ไม่มีประวัติการทำธุรกรรม',
    emptyBonus: 'ไม่มีประวัติรายได้',
    emptyBonusSub: 'จะแสดงที่นี่เมื่อผู้ดูแลระบบดำเนินการสรุปยอดประจำวัน',
    emptyProducts: 'ไม่มีแผน FREEZE',
    emptyNoti: 'ไม่มีการแจ้งเตือน',
    emptyTicket: 'ไม่มีตั๋วสนับสนุน',
    emptyRef: 'ไม่มีการแนะนำ',
    notiTitleMature: '✅ FREEZE ครบกำหนด',
    notiMsgMature: '[{name}] สัญญา FREEZE ครบกำหนดแล้ว เงินต้น {amt} USDT ถูกปลดล็อคเข้ากระเป๋าของคุณ',
    toastMature: '❄️ เงินต้น FREEZE ที่ครบกำหนด {n} รายการถูกปลดล็อคแล้ว',
  `
};

for (const lang of ['ko', 'en', 'vi', 'th']) {
  const searchStr = '  ' + lang + ': {';
  const replaceStr = searchStr + '\n' + keys[lang];
  content = content.replace(searchStr, replaceStr);
}

// -------------------------------------------------------------
// UI Logic Replacements
// -------------------------------------------------------------

// Nep SubTitle
content = content.replace(
  "setEl('nepSubTitle', `하부 ${totalMembers}명 조직 수익 현황`);", 
  "setEl('nepSubTitle', t('orgTitle').replace('{n}', totalMembers));"
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-user-friends"></i><br>${gen}대 하부 멤버가 없습니다</div>', 
  '<div class="empty-state"><i class="fas fa-user-friends"></i><br>${t(\'emptySubGen\').replace(\'{gen}\', gen)}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-network-wired"></i><br>3대 이하 하부 멤버가 없습니다</div>', 
  '<div class="empty-state"><i class="fas fa-network-wired"></i><br>${t(\'emptyDeepGen\')}</div>'
);
content = content.replace(
  '<div style="font-size:13px;font-weight:700;color:var(--text,#f1f5f9);">${g}대 하부</div>', 
  '<div style="font-size:13px;font-weight:700;color:var(--text,#f1f5f9);">${t(\'genSub\').replace(\'{gen}\', g)}</div>'
);
content = content.replace(
  '<div style="font-size:12px;color:var(--text2,#94a3b8);margin-top:2px;">하부 ${count}명 · 당일 $${fmt(today)}</div>', 
  '<div style="font-size:12px;color:var(--text2,#94a3b8);margin-top:2px;">${t(\'subMembers\')} ${count} · ${t(\'todayEarn\')} $${fmt(today)}</div>'
);
content = content.replace(
  '<div style="font-size:11px;color:var(--text2,#94a3b8);margin-top:4px;">${tierName} · 하부 ${myRefs}명</div>', 
  '<div style="font-size:11px;color:var(--text2,#94a3b8);margin-top:4px;">${tierName} · ${t(\'subMembers\')} ${myRefs}</div>'
);

// Product rendering
content = content.replace(
  "return `\n      <div class=\"product-card\" onclick=\"openInvestModal('${p.id}', '${p.name}', ${p.roiPercent}, ${p.durationDays}, ${p.minAmount}, ${p.maxAmount})\">\n        <div class=\"product-header\">\n          <span class=\"product-name\">${p.name}</span>\n          <span class=\"product-roi\">${p.roiPercent}%</span>\n        </div>\n        <div style=\"font-size:10px;text-align:right;color:var(--text2);margin-top:-6px;margin-bottom:8px;\">ROI 일일</div>",
  "return `\n      <div class=\"product-card\" onclick=\"openInvestModal('${p.id}', '${p.name}', ${p.roiPercent}, ${p.durationDays}, ${p.minAmount}, ${p.maxAmount})\">\n        <div class=\"product-header\">\n          <span class=\"product-name\">${t(p.name === '1개월' ? 'productMonth1' : p.name === '3개월' ? 'productMonth3' : p.name === '6개월' ? 'productMonth6' : p.name === '12개월' ? 'productMonth12' : p.name)}</span>\n          <span class=\"product-roi\">${p.roiPercent}%</span>\n        </div>\n        <div style=\"font-size:10px;text-align:right;color:var(--text2);margin-top:-6px;margin-bottom:8px;\">${t('dailyRoi') || 'ROI 일일'}</div>"
);

// Empty States
content = content.replace(
  /<div class="empty-state"><i class="fas fa-snowflake"><\/i>진행 중인 FREEZE가 없습니다<\/div>/g,
  '<div class="empty-state"><i class="fas fa-snowflake"></i>${t(\'emptyInvest\')}</div>'
);
content = content.replace(
  /setEl\('activeInvestCount', sumItems.count \+ '건'\);/g,
  "setEl('activeInvestCount', sumItems.count + (t('investUnit') || '건'));"
);
content = content.replace(
  /setEl\('expectedReturn', fmt\(sumItems.returns\) \+ ' USDT\/일'\);/g,
  "setEl('expectedReturn', fmt(sumItems.returns) + ' USDT' + (t('perDay') || '/일'));"
);
content = content.replace(
  /<span>❄️ 일 수익: <strong style="color:var\(--green\)">\+\$\$\{fmt\(dailyD\)\}<\/strong> \(\$\{\(dailyRoiRate\*100\)\.toFixed\(2\)\}%\/일\)<\/span>/g,
  "<span>${t('dailyReturnLabel')} <strong style=\"color:var(--green)\">+$${fmt(dailyD)}</strong> (${(dailyRoiRate*100).toFixed(2)}%${t('perDay')})</span>"
);
content = content.replace(
  /<span>잔여 \$\{remainDays\}일<\/span>/g,
  "<span>${t('remainDaysLabel').replace('{n}', remainDays)}</span>"
);
content = content.replace(
  /총 예상수익\(일\): \+\$\{fmt\(inv\.expectedReturn \|\| 0\)\} USDT \(원금은 만기 후 출금 가능\)/g,
  "${t('totalExpectedLabel').replace('{n}', fmt(inv.expectedReturn || 0))}"
);
content = content.replace(
  /<span class="invest-item-name">\$\{inv\.productName \|\| 'FREEZE'\}<\/span>/g,
  "<span class=\"invest-item-name\">${t(inv.productName === '1개월' ? 'productMonth1' : inv.productName === '3개월' ? 'productMonth3' : inv.productName === '6개월' ? 'productMonth6' : inv.productName === '12개월' ? 'productMonth12' : (inv.productName || 'FREEZE'))}</span>"
);
content = content.replace(
  "❄️ ${fmt(p.minAmount)} USDT FREEZE 시 일 수익 <strong>~${fmt(dailyEarning)} USDT</strong>",
  "❄️ ${t('productHint1').replace('{min}', fmt(p.minAmount))} <strong>~${fmt(dailyEarning)} USDT</strong>"
);
content = content.replace(
  "(≈ ${fmt(dailyEarning / (deedraPrice||0.5))} DDRA/일) · 🔒 만기 후 언프리즈 가능",
  "(≈ ${fmt(dailyEarning / (deedraPrice||0.5))} DDRA${t('perDay')}) · 🔒 ${t('productHint2')}"
);
content = content.replace(
  "💡 DDRA 환산: ≈ ${fmt(earningDdra)} DDRA/일 (1 DDRA = $${(deedraPrice||0.5).toFixed(4)})<br>",
  "💡 ${t('ddraConvert')}: ≈ ${fmt(earningDdra)} DDRA${t('perDay')} (1 DDRA = $${(deedraPrice||0.5).toFixed(4)})<br>"
);
content = content.replace(
  "📅 만기일: ${getDaysLaterStr(selectedProduct.days)}<br>",
  "📅 ${t('maturityDate')}: ${getDaysLaterStr(selectedProduct.days)}<br>"
);
content = content.replace(
  "🔒 원금은 만기 후 언프리즈 가능합니다.",
  "🔒 ${t('productHint2')}"
);

// Notice
content = content.replace(
  '<div class="empty-state">공지사항이 없습니다</div>',
  '<div class="empty-state">${t(\'emptyNotice\')}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-bullhorn"></i>공지사항이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-bullhorn"></i>${t(\'emptyNotice\')}</div>'
);
content = content.replace(
  '<div class="empty-state">공지사항을 찾을 수 없습니다.</div>',
  '<div class="empty-state">${t(\'emptyNotice\')}</div>'
);
content = content.replace(
  '<div class="empty-state">불러오기 실패</div>',
  '<div class="empty-state">${t(\'loadFail\')}</div>'
);
content = content.replace(
  '<div class="empty-state">거래 내역이 없습니다</div>',
  '<div class="empty-state">${t(\'emptyTx\')}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-receipt"></i>거래 내역이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-receipt"></i>${t(\'emptyTx\')}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-receipt"></i><br>거래 내역이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-receipt"></i><br>${t(\'emptyTx\')}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-coins"></i>수익 내역이 없습니다<br><span style="font-size:12px;color:var(--text2);">관리자가 일일 정산을 실행하면 여기에 표시됩니다.</span></div>',
  '<div class="empty-state"><i class="fas fa-coins"></i>${t(\'emptyBonus\')}<br><span style="font-size:12px;color:var(--text2);">${t(\'emptyBonusSub\')}</span></div>'
);
content = content.replace(
  '<div class="empty-state">수익 내역을 불러오지 못했습니다.</div>',
  '<div class="empty-state">${t(\'loadFail\')}</div>'
);
content = content.replace(
  '<div class="empty-state" style="padding:20px 0;">수익 내역이 없습니다</div>',
  '<div class="empty-state" style="padding:20px 0;">${t(\'emptyBonus\')}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-snowflake"></i>FREEZE 플랜이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-snowflake"></i>${t(\'emptyProducts\')}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-bell-slash"></i><br>알림이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-bell-slash"></i><br>${t(\'emptyNoti\')}</div>'
);
content = content.replace(
  '<div class="empty-state">알림을 불러올 수 없습니다</div>',
  '<div class="empty-state">${t(\'loadFail\')}</div>'
);
content = content.replace(
  '<div class="empty-state">문의 내역이 없습니다</div>',
  '<div class="empty-state">${t(\'emptyTicket\')}</div>'
);
content = content.replace(
  '<div class="empty-state"><i class="fas fa-user-friends"></i>추천인이 없습니다</div>',
  '<div class="empty-state"><i class="fas fa-user-friends"></i>${t(\'emptyRef\')}</div>'
);
content = content.replace(
  "title: '✅ FREEZE 만기 완료',",
  "title: t('notiTitleMature'),"
);
content = content.replace(
  "message: `[${inv.productName}] FREEZE 계약이 만료되었습니다. 원금 ${fmt(inv.amount)} USDT가 지갑에 언프리즈되었습니다.`",
  "message: t('notiMsgMature').replace('{name}', inv.productName).replace('{amt}', fmt(inv.amount))"
);
content = content.replace(
  "showToast(`❄️ 만기 FREEZE ${expired.length}건의 원금이 언프리즈되었습니다.`, 'success');",
  "showToast(t('toastMature').replace('{n}', expired.length), 'success');"
);

fs.writeFileSync(appPath, content, 'utf8');

// Also update i18n.js
const i18nPath = '/home/user/webapp/public/static/i18n.js';
let i18nContent = fs.readFileSync(i18nPath, 'utf8');
for (const lang of ['ko', 'en', 'vi', 'th']) {
  const searchStr = '    ' + lang + ': {';
  const replaceStr = searchStr + '\n' + keys[lang];
  i18nContent = i18nContent.replace(searchStr, replaceStr);
}
fs.writeFileSync(i18nPath, i18nContent, 'utf8');

// Update index.html
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

console.log('Done patching safely!');
