const fs = require('fs');

const file = 'public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = `async function findUserByReferralCode(code) {
  const { collection, query, where, getDocs, limit, db } = window.FB;
  try {
    // 1. 추천인 코드로 검색 (무조건 대문자로 변환해서 검색 - 추천인 코드는 대문자임)
    const q1 = query(collection(db, 'users'), where('referralCode', '==', code.toUpperCase()));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return Object.assign({uid: snap1.docs[0].id}, snap1.docs[0].data());
    
    // 2. 아이디(username)로 검색 (username은 소문자로 저장됨)
    const q2 = query(collection(db, 'users'), where('username', '==', code.toLowerCase()));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return Object.assign({uid: snap2.docs[0].id}, snap2.docs[0].data());
    
    // 3. 혹시 모를 대소문자 그대로의 아이디 검색
    const q3 = query(collection(db, 'users'), where('username', '==', code));
    const snap3 = await getDocs(q3);
    if (!snap3.empty) return Object.assign({uid: snap3.docs[0].id}, snap3.docs[0].data());
    
    return null;
  } catch (e) { console.error('findUser error:', e); return null; }
}`;

const newFunc = `async function findUserByReferralCode(code) {
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

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content);
console.log('patched');
