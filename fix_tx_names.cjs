const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(file, 'utf8');

const target = `const map = { deposit: 'USDT 입금', withdrawal: 'DEEDRA 출금', bonus: '보너스 지급', invest: 'FREEZE 신청', game: '게임', referral: '추천 보너스' };`;
const replacement = `const map = { deposit: 'USDT 입금', withdrawal: 'DEEDRA 출금', bonus: '보너스 지급', invest: 'FREEZE 신청', game: '게임', referral: '추천 보너스', rank_bonus: '판권 매칭', rank_gap_passthru: '예외 보너스', direct_bonus: '추천 매칭', daily_roi: '데일리 수익', center_fee: '센터 피' };`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
console.log('Fixed getTxTypeName');
