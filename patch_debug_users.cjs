const fs = require('fs');

let indexContent = fs.readFileSync('src/index.tsx', 'utf8');
const target = `      const matchedUser = users.find((u: any) =>
        u.solanaWallet === fromAddress || u.depositWalletAddress === fromAddress
      )`;
const rep = `      const matchedUser = users.find((u: any) =>
        u.solanaWallet === fromAddress || u.depositWalletAddress === fromAddress
      )
      if (amount > 0) {
          debugLogs.push({msg: 'Check users', total_users: users.length, sample_wallet: users.length > 0 ? users[0].solanaWallet : ''})
      }`;
indexContent = indexContent.replace(target, rep);
fs.writeFileSync('src/index.tsx', indexContent);
