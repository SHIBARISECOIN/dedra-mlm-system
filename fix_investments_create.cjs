const fs = require('fs');
let rules = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');

rules = rules.replace(
  "      allow create: if isLoggedIn() && \n                    request.resource.data.userId == request.auth.uid &&\n                    request.resource.data.amount > 0 &&\n                    get(/databases/$(database)/documents/wallets/$(request.auth.uid)).data.usdtBalance >= request.resource.data.amount;",
  `      allow create: if isAdminOrSubAdmin() || (isLoggedIn() && 
                    request.resource.data.userId == request.auth.uid &&
                    request.resource.data.amount > 0 &&
                    get(/databases/$(database)/documents/wallets/$(request.auth.uid)).data.usdtBalance >= request.resource.data.amount);`
);

fs.writeFileSync('/home/user/webapp/firestore.rules', rules);
console.log("Fixed investments create rule");
