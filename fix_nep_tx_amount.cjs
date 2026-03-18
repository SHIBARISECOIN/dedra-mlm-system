const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(file, 'utf8');

const target = `    contentEl.innerHTML = txs.map(tx => {
      const isPlus = ['deposit', 'bonus'].includes(tx.type);`;

const replacement = `    contentEl.innerHTML = txs.map(tx => {
      if (tx.isBonus) tx.amount = tx.amountUsdt || tx.amount || 0;
      const isPlus = ['deposit', 'bonus', 'rank_bonus', 'direct_bonus', 'daily_roi', 'center_fee', 'rank_gap_passthru'].includes(tx.type);`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
console.log('Fixed amount for bonuses in _loadNepTxTab');
