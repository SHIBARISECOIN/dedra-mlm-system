const fs = require('fs');

let code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');

const injection = `
      // ----- 자동 입금 체크 (매 분 실행) -----
      try {
        console.log("Running auto-deposit check...");
        const solanaRes = await app.request('/api/solana/check-deposits', {
          method: 'POST',
          headers: { 'x-cron-secret': CRON_SECRET, 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }, env);
        const txt = await solanaRes.text();
        console.log("Auto-deposit check result:", txt);
      } catch(e) {
        console.error("Auto-deposit error:", e);
      }
      
      try {
`;

code = code.replace(
  '    ctx.waitUntil((async () => {\n      try {',
  `    ctx.waitUntil((async () => {${injection}`
);

fs.writeFileSync('/home/user/webapp/src/index.tsx', code);
