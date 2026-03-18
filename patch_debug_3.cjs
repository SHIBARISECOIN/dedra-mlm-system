const fs = require('fs');

let indexContent = fs.readFileSync('src/index.tsx', 'utf8');
const target = `      if (amount > 0) {
          debugLogs.push({msg: 'Check users', total_users: users.length, sample_wallet: users.length > 0 ? users[0].solanaWallet : ''})
      }`;
const rep = `      if (amount > 0) {
          const registeredWallets = users.map(u => u.solanaWallet).filter(Boolean);
          debugLogs.push({msg: 'Check users', fromAddress, registeredWallets});
      }`;
indexContent = indexContent.replace(target, rep);
fs.writeFileSync('src/index.tsx', indexContent);
