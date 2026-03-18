const fs = require('fs');

let indexContent = fs.readFileSync('src/index.tsx', 'utf8');

const target = `    let processed = 0
    for (const sig of signatures) {
      const txHash = sig.signature
      if (!txHash || sig.err) continue`;

const replacement = `    let processed = 0
    let debugLogs = []
    for (const sig of signatures) {
      const txHash = sig.signature
      if (!txHash || sig.err) continue`;

indexContent = indexContent.replace(target, replacement);

const target2 = `      if (amount < 1) continue

      // 해당 지갑으로 등록된 회원 찾기`;

const replacement2 = `      debugLogs.push({txHash, amount, fromAddress, instructions_count: instructions.length})
      if (amount < 1) continue

      // 해당 지갑으로 등록된 회원 찾기`;

indexContent = indexContent.replace(target2, replacement2);

const target3 = `    return c.json({ success: true, processed, total: signatures.length, network: 'solana' })`;
const replacement3 = `    return c.json({ success: true, processed, total: signatures.length, network: 'solana', debugLogs })`;

indexContent = indexContent.replace(target3, replacement3);

fs.writeFileSync('src/index.tsx', indexContent);
console.log('patched debug logs');
