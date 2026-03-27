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

// Insert the helper function before loadGameHistory
code = code.replace(/async function loadGameHistory\(\) \{/, getGameNameTranslatedStr + '\nasync function loadGameHistory() {');

// Fix loadGameHistory
code = code.replace(
  /\<div class="tx-type"\>\$\{name\} \$\{isWin \? '승리' : '패배'\}\<\/div\>/,
  '<div class="tx-type">${getGameNameTranslated(name)} ${isWin ? (t(\'winText\')||\'승리\') : (t(\'loseText\')||\'패배\')}</div>'
);

// Fix logGame
code = code.replace(
  /\<div class="tx-title"\>\$\{gameName\} \$\{isPositive \? '승리' : '패배'\}\<\/div\>/,
  '<div class="tx-title">${getGameNameTranslated(gameName)} ${isPositive ? (t(\'winText\')||\'승리\') : (t(\'loseText\')||\'패배\')}</div>'
);

fs.writeFileSync('public/static/app.js', code);
console.log('Patched game history translation!');
