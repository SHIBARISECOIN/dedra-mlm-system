const fs = require('fs');

// 1. Update src/index.tsx
let indexContent = fs.readFileSync('src/index.tsx', 'utf8');

const newApi = `
// 아이디 중복 검증 API
app.get('/api/auth/check-username', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ exists: false, error: 'Username required' }, 400);
  
  try {
    const token = await getAdminToken();
    const q = await fsQuery('users', token, [{
      fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: username.trim().toLowerCase() } }
    }], 1);
    
    if (q && q.length > 0) {
      return c.json({ exists: true });
    }
    return c.json({ exists: false });
  } catch (e: any) {
    return c.json({ exists: false, error: e.message }, 500);
  }
})
`;

// Insert after check-referral
const targetIdx = indexContent.indexOf(`app.get('/api/auth/check-referral'`);
if (targetIdx !== -1) {
    const before = indexContent.substring(0, targetIdx);
    const after = indexContent.substring(targetIdx);
    indexContent = before + newApi + '\n' + after;
    fs.writeFileSync('src/index.tsx', indexContent);
    console.log('patched index.tsx');
}

// 2. Update app.js
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

const targetStr = `  const referrer = await findUserByReferralCode(refCode);
  if (!referrer) { showToast(t('registerInvalidRef'), 'error'); return; }

  showScreen('loading');
  try {`;

const repStr = `  const referrer = await findUserByReferralCode(refCode);
  if (!referrer) { showToast(t('registerInvalidRef'), 'error'); return; }

  showScreen('loading');
  try {
    // 아이디 중복 체크
    const uRes = await fetch(\`/api/auth/check-username?username=\${encodeURIComponent(username)}\`);
    const uData = await uRes.json();
    if (uData.exists) {
      showScreen('auth');
      showToast('이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.', 'error');
      return;
    }
`;

appJs = appJs.replace(targetStr, repStr);

// Also add real-time check UI
const uiStr = `// 추천인 코드 실시간 검증`;
const uiRepStr = `// 아이디 중복 실시간 검증
document.addEventListener('DOMContentLoaded', () => {
  const userInp = document.getElementById('regUsername');
  if (!userInp) return;
  
  // 상태 메시지 표시할 요소 추가
  let statusEl = document.getElementById('regUserStatus');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'regUserStatus';
    statusEl.style.cssText = 'font-size:12px; margin-top:4px; margin-left:4px;';
    userInp.parentNode.appendChild(statusEl);
  }

  let uTimer = null;
  userInp.addEventListener('input', (e) => {
    let val = e.target.value.trim().toLowerCase();
    // 아이디는 영문, 숫자만 허용되도록 정제 (선택사항, 일단 소문자 변환만 유지)
    e.target.value = val;
    
    if (!val) { statusEl.textContent = ''; return; }
    if (val.length < 4) { 
      statusEl.textContent = '아이디는 4자 이상이어야 합니다.';
      statusEl.style.color = '#ef4444';
      return; 
    }
    
    statusEl.textContent = '🔍 중복 확인 중...';
    statusEl.style.color = '#a5b4fc';
    
    clearTimeout(uTimer);
    uTimer = setTimeout(async () => {
      try {
        const res = await fetch(\`/api/auth/check-username?username=\${encodeURIComponent(val)}\`);
        const data = await res.json();
        if (data.exists) {
          statusEl.textContent = '❌ 이미 사용 중인 아이디입니다.';
          statusEl.style.color = '#ef4444';
        } else {
          statusEl.textContent = '✅ 사용 가능한 아이디입니다.';
          statusEl.style.color = '#10b981';
        }
      } catch(err) {
        statusEl.textContent = '';
      }
    }, 600);
  });
});

// 추천인 코드 실시간 검증`;

appJs = appJs.replace(uiStr, uiRepStr);

fs.writeFileSync('public/static/app.js', appJs);
console.log('patched app.js');
