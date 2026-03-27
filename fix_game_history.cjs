const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const getGameNameTranslatedStr = `
function getGameNameTranslated(name) {
  if (name === '홀짝') return t('gameOddEven') || '홀짝';
  if (name === '주사위') return t('gameDice') || '주사위';
  if (name === '슬롯머신') return t('gameSlot') || '슬롯머신';
  if (name === '바카라') return t('gameBaccarat') || '바카라';
  if (name === '룰렛') return t('gameRoulette') || '룰렛';
  if (name === '포커') return t('gamePoker') || '포커';
  return name;
}
`;

// getGameNameTranslated가 없는 경우에만 삽입
if (!code.includes('function getGameNameTranslated')) {
  // logGame 함수 앞에 삽입
  code = code.replace(/function logGame\(/, getGameNameTranslatedStr + '\nfunction logGame(');
}

fs.writeFileSync('public/static/app.js', code);
console.log('Fixed game history translation!');
