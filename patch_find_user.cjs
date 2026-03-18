const fs = require('fs');

let appJs = fs.readFileSync('public/static/app.js', 'utf8');

const oldFunc = `async function findUserByReferralCode(code) {
  const { collection, query, where, getDocs, db } = window.FB;
  try {
    if (!code) return null;
    const cleanCode = code.trim();
    
    // 1. 추천인 코드 (대문자)
    const q1 = query(collection(db, 'users'), where('referralCode', '==', cleanCode.toUpperCase()));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return { uid: snap1.docs[0].id, ...snap1.docs[0].data() };
    
    // 2. 아이디 (소문자 변환)
    const q2 = query(collection(db, 'users'), where('username', '==', cleanCode.toLowerCase()));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return { uid: snap2.docs[0].id, ...snap2.docs[0].data() };
    
    // 3. 아이디 (입력한 그대로)
    const q3 = query(collection(db, 'users'), where('username', '==', cleanCode));
    const snap3 = await getDocs(q3);
    if (!snap3.empty) return { uid: snap3.docs[0].id, ...snap3.docs[0].data() };
    
    return null;
  } catch (e) { console.error('findUser error:', e); return null; }
}`;

const newFunc = `async function findUserByReferralCode(code) {
  try {
    if (!code) return null;
    const cleanCode = code.trim();
    
    // 백엔드 API를 통해 검증 (비로그인 상태에서도 조회 가능)
    const res = await fetch(\`/api/auth/check-referral?code=\${encodeURIComponent(cleanCode)}\`);
    const data = await res.json();
    
    if (res.ok && data.valid) {
      return {
        uid: data.uid,
        name: data.name,
        username: data.username,
        email: data.email
      };
    }
    return null;
  } catch (e) { console.error('findUser API error:', e); return null; }
}`;

appJs = appJs.replace(oldFunc, newFunc);
fs.writeFileSync('public/static/app.js', appJs);
console.log('patched app.js');
