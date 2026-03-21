const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public/static/app.js');
let js = fs.readFileSync(appJsPath, 'utf8');

const regex = /batch\.update\(doc\(db, 'wallets', currentUser\.uid\), \{\s*usdtBalance: increment\(inv\.amount \|\| 0\)\s*\}\);/;

const replacement = `batch.update(doc(db, 'wallets', currentUser.uid), {
        usdtBalance: increment(inv.amount || 0),
        totalInvest: increment(-(inv.amount || 0))
      });`;

if (js.match(regex)) {
    js = js.replace(regex, replacement);
    
    // Also update local walletData
    js = js.replace(/walletData\.usdtBalance = \(walletData\.usdtBalance \|\| 0\) \+ \(inv\.amount \|\| 0\);/,
    `walletData.usdtBalance = (walletData.usdtBalance || 0) + (inv.amount || 0);
        walletData.totalInvest = Math.max(0, (walletData.totalInvest || 0) - (inv.amount || 0));`);
        
    fs.writeFileSync(appJsPath, js);
    console.log('Fixed autoCompleteExpiredInvestments to decrement totalInvest');
} else {
    console.log('Regex did not match for autoCompleteExpiredInvestments');
}
