const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/js/api.js', 'utf8');

// We want to replace the logic that queries 'transactions' for deposits with querying 'wallets' for totalInvest.
// _calcBalancedVolume
let oldCalcSales = `          const txSnap = await getDocs(query(
            collection(db, 'transactions'),
            where('userId', 'in', chunk),
            where('type', '==', 'deposit'),
            where('status', '==', 'approved')
          ));
          sales += txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);`;

let newCalcSales = `          const wSnap = await getDocs(query(
            collection(db, 'wallets'),
            where('userId', 'in', chunk)
          ));
          sales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);`;

code = code.replace(oldCalcSales, newCalcSales);

// _checkAndPromoteSingleUser and others (3 places)
let oldNetworkSales = `            const txSnap = await getDocs(query(
              collection(db, 'transactions'),
              where('userId', 'in', chunk),
              where('type', '==', 'deposit'),
              where('status', '==', 'approved')
            ));
            networkSales += txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);`;

let newNetworkSales = `            const wSnap = await getDocs(query(
              collection(db, 'wallets'),
              where('userId', 'in', chunk)
            ));
            networkSales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);`;

code = code.replace(oldNetworkSales, newNetworkSales);

// Let's also check if there's a different indentation for networkSales
let oldNetworkSales2 = `        const txSnap = await getDocs(query(
          collection(db, 'transactions'),
          where('userId', 'in', chunk),
          where('type', '==', 'deposit'),
          where('status', '==', 'approved')
        ));
        networkSales += txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);`;

let newNetworkSales2 = `        const wSnap = await getDocs(query(
          collection(db, 'wallets'),
          where('userId', 'in', chunk)
        ));
        networkSales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);`;

code = code.replace(oldNetworkSales2, newNetworkSales2);

let oldNetworkSales3 = `          const txSnap = await getDocs(query(
            collection(db, 'transactions'),
            where('userId', 'in', chunk),
            where('type', '==', 'deposit'),
            where('status', '==', 'approved')
          ));
          networkSales += txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);`;
          
code = code.replace(oldNetworkSales3, newNetworkSales);

fs.writeFileSync('/home/user/webapp/public/static/js/api.js', code);
console.log('Fixed networkSales and balancedVolume logic in api.js to use totalInvest from wallets instead of deposits.');
