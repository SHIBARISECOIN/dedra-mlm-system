const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `    // 단일 where → JS 정렬·슬라이스 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid)
    );`;

const replacement = `    // 단일 where → JS 정렬·슬라이스 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      limit(100) // 수천건 로딩 방지 (최대 100개까지만)
    );`;

code = code.replace(target, replacement);

fs.writeFileSync('public/static/app.js', code);
console.log("Patched tx query!");
