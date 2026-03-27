const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `    // 단일 where → JS 정렬·슬라이스 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      limit(100) // 수천건 로딩 방지 (최대 100개까지만)
    );`;

const replacement = `    // 단일 where → JS 정렬·슬라이스 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid)
    );`;

code = code.replace(target, replacement);

const ddayTarget = `    // 단일 where만 사용 → JS에서 필터·정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      limit(50) // 문서 과다 로딩 방지
    );`;

const ddayReplacement = `    // 단일 where만 사용 → JS에서 필터·정렬 (복합 인덱스 불필요)
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid)
    );`;

code = code.replace(ddayTarget, ddayReplacement);

fs.writeFileSync('public/static/app.js', code);
console.log("Reverted limit patches to prevent random ordering bug!");
