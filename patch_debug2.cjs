const fs = require('fs');
let indexContent = fs.readFileSync('src/index.tsx', 'utf8');

const target = `      const matchedUser = users.find((u: any) =>
        u.solanaWallet === fromAddress || u.depositWalletAddress === fromAddress
      )`;

const replacement = `      const matchedUser = users.find((u: any) =>
        u.solanaWallet === fromAddress || u.depositWalletAddress === fromAddress
      )
      if (amount > 0 && !matchedUser) {
        debugLogs.push({ msg: 'User not found for address', fromAddress })
      }`;

indexContent = indexContent.replace(target, replacement);
fs.writeFileSync('src/index.tsx', indexContent);
