const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// 1. Add 'neededMembers' and 'statusCompleted' or similar to TRANSLATIONS
// We will just replace "명 필요" with `t('neededMembers')` and hardcode the fallback.
// Actually, let's inject some keys into the TRANSLATIONS object.

function injectToTranslation(lang, key, val) {
  const regex = new RegExp(`(${lang}:\\s*\\{[\\s\\S]*?)(\\n  \\},|\\n    [a-zA-Z0-9_]+:)`, 'm');
  code = code.replace(regex, `$1\n    ${key}: '${val}',$2`);
}

injectToTranslation('ko', 'neededMembers', '명 필요');
injectToTranslation('en', 'neededMembers', ' needed');
injectToTranslation('vi', 'neededMembers', ' người cần thêm');
injectToTranslation('th', 'neededMembers', ' คนที่ต้องการ');

// For transaction types
injectToTranslation('ko', 'typeDeposit', '입금');
injectToTranslation('en', 'typeDeposit', 'Deposit');
injectToTranslation('vi', 'typeDeposit', 'Nạp');
injectToTranslation('th', 'typeDeposit', 'ฝาก');

injectToTranslation('ko', 'typeWithdraw', '출금');
injectToTranslation('en', 'typeWithdraw', 'Withdrawal');
injectToTranslation('vi', 'typeWithdraw', 'Rút');
injectToTranslation('th', 'typeWithdraw', 'ถอน');

injectToTranslation('ko', 'typeInvest', '투자');
injectToTranslation('en', 'typeInvest', 'Invest');
injectToTranslation('vi', 'typeInvest', 'Đầu tư');
injectToTranslation('th', 'typeInvest', 'ลงทุน');

injectToTranslation('ko', 'typeBonus', '수익');
injectToTranslation('en', 'typeBonus', 'Bonus');
injectToTranslation('vi', 'typeBonus', 'Thưởng');
injectToTranslation('th', 'typeBonus', 'โบนัส');

injectToTranslation('ko', 'typeGame', '게임');
injectToTranslation('en', 'typeGame', 'Game');
injectToTranslation('vi', 'typeGame', 'Trò chơi');
injectToTranslation('th', 'typeGame', 'เกม');

injectToTranslation('ko', 'statusCompleted', '완료');
injectToTranslation('en', 'statusCompleted', 'Completed');
injectToTranslation('vi', 'statusCompleted', 'Hoàn tất');
injectToTranslation('th', 'statusCompleted', 'เสร็จสมบูรณ์');

// 2. Fix rankNextLabel
const targetRank = "setEl('rankNextLabel', `${nextRankObj.rank} (${nextRankObj.minRefs - refCount}명 필요)`);";
const replaceRank = "setEl('rankNextLabel', `${nextRankObj.rank} (${nextRankObj.minRefs - refCount}${t('neededMembers') || '명 필요'})`);";
code = code.replace(targetRank, replaceRank);

const targetTopRank = "setEl('rankNextLabel', '최고 직급 달성! 🏆');";
const replaceTopRank = "setEl('rankNextLabel', t('topRankAchieved') || '최고 직급 달성! 🏆');";
code = code.replace(targetTopRank, replaceTopRank);

// 3. Fix types in initLiveTransactionMarquee
const targetTypes = `    const types = { 
      'deposit': { icon: '📥', color: '#10b981', label: '입금' },
      'withdrawal': { icon: '📤', color: '#f43f5e', label: '출금' },
      'invest': { icon: '💼', color: '#6366f1', label: '투자' },
      'bonus': { icon: '🎁', color: '#f59e0b', label: '수익' },
      'game': { icon: '🎮', color: '#8b5cf6', label: '게임' }
    };`;
    
const replaceTypes = `    const types = { 
      'deposit': { icon: '📥', color: '#10b981', label: t('typeDeposit') || '입금' },
      'withdrawal': { icon: '📤', color: '#f43f5e', label: t('typeWithdraw') || '출금' },
      'invest': { icon: '💼', color: '#6366f1', label: t('typeInvest') || '투자' },
      'bonus': { icon: '🎁', color: '#f59e0b', label: t('typeBonus') || '수익' },
      'game': { icon: '🎮', color: '#8b5cf6', label: t('typeGame') || '게임' }
    };`;
code = code.replace(targetTypes, replaceTypes);

// 4. Fix '완료' in marquee
const targetMarqueeDone = `\${info.label} 완료`;
const replaceMarqueeDone = `\${info.label} \${t('statusCompleted') || '완료'}`;
code = code.replace(targetMarqueeDone, replaceMarqueeDone);

fs.writeFileSync('public/static/app.js', code);
console.log("Patched network translations!");
