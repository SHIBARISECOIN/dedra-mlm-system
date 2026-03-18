const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const regex = /\} else \{\n\s*qList = \[\n\s*query\(collection\(db, 'bonuses'\), where\('userId', '==', currentUser.uid\), limit\(50\)\)\n\s*\];\n\s*\}/;

const newAll = `} else {
        qList = [
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'daily_roi'), limit(20)),
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'direct_bonus'), limit(20)),
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_bonus'), limit(20)),
          query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', '==', 'rank_gap_passthru'), limit(10))
        ];
      }`;

appJs = appJs.replace(regex, newAll);
fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Fixed 'all' history fetching for bonuses");
