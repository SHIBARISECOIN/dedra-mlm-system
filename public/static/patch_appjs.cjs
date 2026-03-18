const fs = require('fs');

const additions = {
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
  `
};

const appJsPath = '/home/user/webapp/public/static/app.js';
let appContent = fs.readFileSync(appJsPath, 'utf8');

// Replace using simpler string replacement to avoid regex issues
for (const lang of ['ko', 'en', 'vi', 'th']) {
  const searchStr = '  ' + lang + ': {';
  const replaceStr = searchStr + '\\n' + additions[lang];
  appContent = appContent.replace(searchStr, replaceStr);
}

fs.writeFileSync(appJsPath, appContent, 'utf8');

// Do the same for i18n.js
const i18nJsPath = '/home/user/webapp/public/static/i18n.js';
if (fs.existsSync(i18nJsPath)) {
  let i18nContent = fs.readFileSync(i18nJsPath, 'utf8');
  for (const lang of ['ko', 'en', 'vi', 'th']) {
    const searchStr = '    ' + lang + ': {';
    const replaceStr = searchStr + '\\n' + additions[lang];
    i18nContent = i18nContent.replace(searchStr, replaceStr);
  }
  fs.writeFileSync(i18nJsPath, i18nContent, 'utf8');
}

console.log('Patched missing keys safely');
