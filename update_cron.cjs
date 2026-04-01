const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');

const oldCron = `        const utcD = now.getUTCDay();
        const utcH = now.getUTCHours();
        const utcM = now.getUTCMinutes();
        
        // 토요일(6) 15:00 ~ 15:05 UTC (한국시간 토요일 24:00 = 일요일 00:00)
        if (utcD === 6 && utcH === 15 && utcM >= 0 && utcM < 5) {
           console.log("Running weekly jackpot draw...");
           const jpRes = await app.request('/api/cron/draw-weekly-jackpot', {
             method: 'GET',
             headers: { 'x-cron-secret': CRON_SECRET }
           }, env);
           const txt = await jpRes.text();
           console.log("Weekly jackpot draw result:", txt);
        }`;

const newCron = `        const utcD = now.getUTCDay();
        const utcH = now.getUTCHours();
        const utcM = now.getUTCMinutes();
        
        const adminToken = await getAdminToken();
        const jpSettings = await fsGet('events/weekly_jackpot', adminToken);
        
        // default: active=true, drawDay=6 (Saturday UTC 15:00 = Sunday 00:00 KST)
        const isActive = jpSettings && jpSettings.active !== false;
        const targetDay = jpSettings && jpSettings.drawDay !== undefined ? jpSettings.drawDay : 6;
        
        if (isActive && utcD === targetDay && utcH === 15 && utcM >= 0 && utcM < 5) {
           console.log("Running weekly jackpot draw...");
           const jpRes = await app.request('/api/cron/draw-weekly-jackpot', {
             method: 'GET',
             headers: { 'x-cron-secret': CRON_SECRET }
           }, env);
           const txt = await jpRes.text();
           console.log("Weekly jackpot draw result:", txt);
        }`;

if (code.includes(oldCron)) {
    code = code.replace(oldCron, newCron);
    fs.writeFileSync('/home/user/webapp/src/index.tsx', code);
    console.log("Cron updated successfully in index.tsx");
} else {
    console.log("Could not find the target string in index.tsx");
}
