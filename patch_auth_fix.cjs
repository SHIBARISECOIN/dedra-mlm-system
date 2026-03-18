const fs = require('fs');

let indexContent = fs.readFileSync('src/index.tsx', 'utf8');

const oldCode = `    // 1. 추천인 코드 (대문자)
    let q = await fsQuery('users', token, [{
      fieldFilter: { field: { fieldPath: 'referralCode' }, op: 'EQUAL', value: { stringValue: cleanCode.toUpperCase() } }
    }], 1);
    
    // 2. 아이디 (소문자)
    if (!q || q.length === 0 || !q[0].document) {
      q = await fsQuery('users', token, [{
        fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: cleanCode.toLowerCase() } }
      }], 1);
    }
    
    // 3. 아이디 (원래 입력값)
    if (!q || q.length === 0 || !q[0].document) {
      q = await fsQuery('users', token, [{
        fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: cleanCode } }
      }], 1);
    }

    if (q && q.length > 0 && q[0].document) {
      const doc = q[0].document;
      const data = doc.fields;
      return c.json({
        valid: true,
        uid: doc.name.split('/').pop(),
        name: data.name?.stringValue || '',
        username: data.username?.stringValue || '',
        email: data.email?.stringValue || ''
      });
    }`;

const newCode = `    // 1. 추천인 코드 (대문자)
    let q = await fsQuery('users', token, [{
      fieldFilter: { field: { fieldPath: 'referralCode' }, op: 'EQUAL', value: { stringValue: cleanCode.toUpperCase() } }
    }], 1);
    
    // 2. 아이디 (소문자)
    if (!q || q.length === 0) {
      q = await fsQuery('users', token, [{
        fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: cleanCode.toLowerCase() } }
      }], 1);
    }
    
    // 3. 아이디 (원래 입력값)
    if (!q || q.length === 0) {
      q = await fsQuery('users', token, [{
        fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: cleanCode } }
      }], 1);
    }

    if (q && q.length > 0) {
      const user = q[0];
      return c.json({
        valid: true,
        uid: user.id || user.uid || '',
        name: user.name || '',
        username: user.username || '',
        email: user.email || ''
      });
    }`;

indexContent = indexContent.replace(oldCode, newCode);
fs.writeFileSync('src/index.tsx', indexContent);
console.log('Fixed check-referral logic');
