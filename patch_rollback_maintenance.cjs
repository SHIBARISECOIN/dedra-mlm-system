const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const turnOn = `
    // --- 시스템 유지보수 모드 ON ---
    try {
      await fsPatch('settings/system', {
        maintenanceMode: true,
        maintenanceMessage: '정산 오류 보정 및 롤백 작업을 진행하고 있습니다.<br>잠시만 기다려주세요.'
      }, adminToken);
    } catch(e) {}
`;

const turnOff = `
    // --- 시스템 유지보수 모드 OFF ---
    try {
      await fsPatch('settings/system', { maintenanceMode: false }, adminToken);
    } catch(e) {}
`;

// Rollback endpoint patch
code = code.replace("    console.log(\"Found bonuses to rollback:\", bonuses.length);", turnOn + "\n    console.log(\"Found bonuses to rollback:\", bonuses.length);");

code = code.replace("    return c.json({ \n      success: true, \n      message: `${targetDate} 정산이 롤백되었습니다.`,", turnOff + "\n    return c.json({ \n      success: true, \n      message: `${targetDate} 정산이 롤백되었습니다.`,");

fs.writeFileSync('src/index.tsx', code);
console.log('patched index.tsx rollback');
