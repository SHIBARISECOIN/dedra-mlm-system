const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// replace the fetching logic for bonuses
const fetchRegex = /if \(\['all', 'invest', 'matching', 'centerFee', 'rankBonus'\]\.includes\(typeFilter\)\) \{[\s\S]*?txs = txs\.concat\(fetchedBonuses\);\s*\}/;

const newFetch = `if (['all', 'invest', 'matching', 'centerFee', 'rankBonus'].includes(typeFilter)) {
      let qList = [];
      if (typeFilter === 'invest') {
        qList = [
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'daily_roi'), limit(50))
        ];
      } else if (typeFilter === 'matching') {
        qList = [
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'direct_bonus'), limit(50))
        ];
      } else if (typeFilter === 'rankBonus') {
        qList = [
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_bonus'), limit(50)),
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_gap_passthru'), limit(20)),
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override_1pct'), limit(20)),
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_equal_or_higher_override'), limit(20))
        ];
      } else if (typeFilter === 'centerFee') {
        qList = [
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'center_fee'), limit(50))
        ];
      } else {
        qList = [
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), limit(50))
        ];
      }

      for (const q of qList) {
        const snap = await getDocs(q);
        const fetchedBonuses = snap.docs.map(d => ({ id: d.id, _collection: 'bonuses', ...d.data() }));
        txs = txs.concat(fetchedBonuses);
      }
    }`;

appJs = appJs.replace(fetchRegex, newFetch);

// Also add daily_roi to typeLabel
appJs = appJs.replace(
  /roi_income: '☀️ 데일리 수익', roi: '☀️ 데일리 수익', direct_bonus: '👥 추천 매칭',/,
  `roi_income: '☀️ 데일리 수익', roi: '☀️ 데일리 수익', daily_roi: '☀️ 데일리 수익', direct_bonus: '👥 추천 매칭',`
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Updated history logic in app.js");
