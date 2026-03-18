const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// replace the fetching logic for transactions to ALSO fetch investments
const txFetchRegex = /if \(\['all', 'deposit', 'withdrawal', 'invest'\]\.includes\(typeFilter\)\) \{[\s\S]*?txs = txs\.concat\(fetchedTxs\);\s*\}/;

const newTxFetch = `if (['all', 'deposit', 'withdrawal', 'invest'].includes(typeFilter)) {
      let q;
      if (typeFilter === 'all') {
        q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), limit(50));
      } else {
        q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', typeFilter), limit(50));
      }
      const snap = await getDocs(q);
      const fetchedTxs = snap.docs.map(d => ({ id: d.id, _collection: 'transactions', ...d.data() }));
      txs = txs.concat(fetchedTxs);
      
      // Also fetch from investments collection for 'invest' or 'all'
      if (['all', 'invest'].includes(typeFilter)) {
        const invQ = query(collection(db, 'investments'), where('userId', '==', currentUser.uid), limit(50));
        const invSnap = await getDocs(invQ);
        const fetchedInvs = invSnap.docs.map(d => ({
          id: d.id,
          _collection: 'investments',
          type: 'invest', // mapped type
          amount: d.data().amount,
          createdAt: d.data().createdAt || d.data().startDate,
          ...d.data()
        }));
        txs = txs.concat(fetchedInvs);
      }
    }`;

appJs = appJs.replace(txFetchRegex, newTxFetch);

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Updated history logic to include investments.");
