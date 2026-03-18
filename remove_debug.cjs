const fs = require('fs');
let indexContent = fs.readFileSync('src/index.tsx', 'utf8');

indexContent = indexContent.replace(`    let debugLogs = []`, ``);
indexContent = indexContent.replace(/debugLogs\.push[^\n]+\n/g, '');
indexContent = indexContent.replace(`debugLogs })`, `})`);
indexContent = indexContent.replace(`network: 'solana',  })`, `network: 'solana' })`);

fs.writeFileSync('src/index.tsx', indexContent);
console.log('removed debug');
