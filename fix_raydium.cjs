const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const newDexFunc = `window.openDexSwap = function(type) {
  const usdtMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const ddraMint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // Mocked or actual token mint
  
  let inputMint = type === 'buy' ? usdtMint : ddraMint;
  let outputMint = type === 'buy' ? ddraMint : usdtMint;
  
  const url = \`https://raydium.io/swap/?inputCurrency=\${inputMint}&outputCurrency=\${outputMint}&fixed=in\`;
  window.open(url, '_blank');
};`;

appJs = appJs.replace(/window\.openDexSwap = function\(type\) \{[\s\S]*?\/\/ ===== 실시간 암호화폐 시세 \(Upbit\) =====/, newDexFunc + '\n// ===== 실시간 암호화폐 시세 (Upbit) =====');

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs, 'utf8');
console.log('Raydium DEX restored.');
