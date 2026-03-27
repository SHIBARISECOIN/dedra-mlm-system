const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `    // 단일 where만 사용 → JS에서 필터·정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid)
    );`;

const replacement = `    // 단일 where만 사용 → JS에서 필터·정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      limit(50) // 문서 과다 로딩 방지
    );`;

code = code.replace(target, replacement);

fs.writeFileSync('public/static/app.js', code);
console.log("Patched dday query!");
