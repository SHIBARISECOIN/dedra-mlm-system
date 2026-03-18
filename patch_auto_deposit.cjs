const fs = require('fs');
let indexContent = fs.readFileSync('src/index.tsx', 'utf8');

const target1 = `      const alreadyProcessed = existing.find((t: any) => t.txHash === txHash && t.status === 'approved')`;
const rep1 = `      const alreadyProcessed = existing.find((t: any) => (t.txHash === txHash || t.txid === txHash) && t.status === 'approved')`;
indexContent = indexContent.replace(target1, rep1);

const target2 = `      // 해당 지갑으로 등록된 회원 찾기
      const users = await fsQuery('users', adminToken)
      const matchedUser = users.find((u: any) =>
        u.solanaWallet === fromAddress || u.depositWalletAddress === fromAddress
      )
      if (amount > 0) {
          const registeredWallets = users.map(u => u.solanaWallet).filter(Boolean);
          debugLogs.push({msg: 'Check users', fromAddress, registeredWallets});
      }
      if (amount > 0 && !matchedUser) {
        debugLogs.push({ msg: 'User not found for address', fromAddress })
      }

      if (matchedUser) {
        const txId = \`sol_\${txHash.slice(0, 20)}\`
        await fsSet(\`transactions/\${txId}\`, {
          userId: matchedUser.id,
          type: 'deposit',
          amount,
          amountUsdt: amount,
          txHash,
          status: 'approved',
          source: 'solana_auto',
          network: 'solana',
          createdAt: new Date().toISOString(),
          approvedAt: new Date().toISOString()
        }, adminToken)`;

const rep2 = `      // 해당 지갑으로 등록된 회원 찾기
      const users = await fsQuery('users', adminToken)
      
      // 1. Pending 트랜잭션 매칭 시도 (유저가 수동으로 입력한 TXID)
      const pendingTx = existing.find((t: any) => (t.txHash === txHash || t.txid === txHash) && t.status === 'pending' && t.type === 'deposit')
      
      let matchedUser = null;
      let targetTxId = \`sol_\${txHash.slice(0, 20)}\`;
      let isUpdate = false;
      
      if (pendingTx) {
          matchedUser = users.find((u: any) => u.id === pendingTx.userId);
          targetTxId = pendingTx.id;
          isUpdate = true;
      } else {
          matchedUser = users.find((u: any) =>
            (u.solanaWallet && u.solanaWallet === fromAddress) || 
            (u.depositWalletAddress && u.depositWalletAddress === fromAddress)
          )
      }

      if (amount > 0 && !matchedUser) {
        debugLogs.push({ msg: 'User not found for address/txid', fromAddress, txHash })
      }

      if (matchedUser) {
        if (isUpdate) {
            await fsPatch(\`transactions/\${targetTxId}\`, {
              amount,
              amountUsdt: amount,
              txHash,
              status: 'approved',
              approvedAt: new Date().toISOString()
            }, adminToken)
        } else {
            await fsSet(\`transactions/\${targetTxId}\`, {
              userId: matchedUser.id,
              userEmail: matchedUser.email || '',
              type: 'deposit',
              amount,
              amountUsdt: amount,
              txHash,
              status: 'approved',
              source: 'solana_auto',
              network: 'solana',
              createdAt: new Date().toISOString(),
              approvedAt: new Date().toISOString()
            }, adminToken)
        }`;

indexContent = indexContent.replace(target2, rep2);
fs.writeFileSync('src/index.tsx', indexContent);
console.log('patched check-deposits logic');
