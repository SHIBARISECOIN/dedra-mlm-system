const fs = require('fs');
let rules = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');

rules = rules.replace(
  "    match /investments/{docId} {\n      allow read: if isLoggedIn();\n      allow create: if isLoggedIn();\n      allow update, delete: if isAdminOrSubAdmin();\n    }",
  `    match /investments/{docId} {
      allow read: if isLoggedIn();
      allow create: if isLoggedIn() && 
                    request.resource.data.userId == request.auth.uid &&
                    request.resource.data.amount > 0 &&
                    get(/databases/$(database)/documents/wallets/$(request.auth.uid)).data.usdtBalance >= request.resource.data.amount;
      allow update, delete: if isAdminOrSubAdmin();
    }`
);

fs.writeFileSync('/home/user/webapp/firestore.rules', rules);
console.log("Fixed investments rule");
