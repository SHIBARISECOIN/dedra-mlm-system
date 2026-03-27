const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const turnOn = `
    // --- 시스템 유지보수 모드 ON ---
    try {
      await fsPatch('settings/system', {
        maintenanceMode: true,
        maintenanceMessage: '현재 안정적인 서비스 제공과 정확한 수익 정산을 위해<br>시스템 동기화 작업을 진행하고 있습니다.<br><br><span style="color:#ef4444;font-size:13px;">작업 중에는 접속이 제한되오니 조금만 기다려주세요.</span>'
      }, adminToken);
    } catch(e) { console.error('Failed to set maintenance mode', e); }
`;

const turnOff = `
    // --- 시스템 유지보수 모드 OFF ---
    try {
      await fsPatch('settings/system', { maintenanceMode: false }, adminToken);
    } catch(e) { console.error('Failed to unset maintenance mode', e); }
`;

// Insert after the lock is acquired and verified
code = code.replace("    const investments = await fsQuery('investments', adminToken, [], 100000)", turnOn + "\n    const investments = await fsQuery('investments', adminToken, [], 100000)");

// Insert before return
code = code.replace("    return c.json({ success: true, message: `${today} 정산 완료`", turnOff + "\n    return c.json({ success: true, message: `${today} 정산 완료`");

// Insert in catch block of runSettle
const errorCatch = `  } catch (err: any) {
    console.error('runSettle Error:', err)
    
    // --- 시스템 유지보수 모드 OFF (에러 시) ---
    try {
      const at = await getAdminToken();
      await fsPatch('settings/system', { maintenanceMode: false }, at);
    } catch(e) {}
`;
code = code.replace("  } catch (err: any) {\n    console.error('runSettle Error:', err)", errorCatch);

fs.writeFileSync('src/index.tsx', code);
console.log('patched index.tsx');
