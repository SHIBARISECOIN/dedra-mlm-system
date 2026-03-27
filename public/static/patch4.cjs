const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// Insert translations
code = code.replace(/(liveGlobalTx: '🔥 실시간 글로벌 트랜잭션',)/, "$1\n    shortageLabel: '부족',\n    achievedLabel: '✔ 달성 완료',");
code = code.replace(/(liveGlobalTx: '🔥 Live Global Transactions',)/, "$1\n    shortageLabel: 'short',\n    achievedLabel: '✔ Achieved',");
code = code.replace(/(liveGlobalTx: '🔥 Giao dịch Toàn cầu Trực tiếp',)/, "$1\n    shortageLabel: 'thiếu',\n    achievedLabel: '✔ Đã đạt',");
code = code.replace(/(liveGlobalTx: '🔥 ธุรกรรมสดทั่วโลก',)/, "$1\n    shortageLabel: 'ขาด',\n    achievedLabel: '✔ สำเร็จ',");

// Update line 6069
const oldLine = 'const diffMsg = diff > 0 ? `<span style="color:#ef4444;">${diff.toLocaleString()} ${unit} 부족</span>` : `<span style="color:#10b981;">✔ 달성 완료</span>`;';
const newLine = 'const diffMsg = diff > 0 ? `<span style="color:#ef4444;">${diff.toLocaleString()} ${unit} ${t("shortageLabel") || "부족"}</span>` : `<span style="color:#10b981;">${t("achievedLabel") || "✔ 달성 완료"}</span>`;';

code = code.replace(oldLine, newLine);

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
