const fs = require('fs');

let indexContent = fs.readFileSync('src/index.tsx', 'utf8');

const newEndpoint = `
// 추천인 코드 검증 API (비로그인 상태에서 Firestore 조회)
app.get('/api/auth/check-referral', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ valid: false, error: 'Code required' }, 400);
  const cleanCode = code.trim();

  try {
    const token = await getAdminToken();
    
    // 1. 추천인 코드 (대문자)
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
    }
    
    return c.json({ valid: false, error: 'Not found' }, 404);
  } catch (e: any) {
    return c.json({ valid: false, error: e.message }, 500);
  }
})

`;

// Insert after register block
const targetStr = `  return c.json({\n    idToken: data.idToken,\n    localId: data.localId,\n    email: data.email,\n    refreshToken: data.refreshToken\n  })\n})`;
indexContent = indexContent.replace(targetStr, targetStr + '\n' + newEndpoint);

fs.writeFileSync('src/index.tsx', indexContent);
console.log('patched index.tsx');
