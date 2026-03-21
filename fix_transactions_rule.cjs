const fs = require('fs');
let rules = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');

rules = rules.replace(
  "    match /transactions/{docId} {\n      allow read: if isLoggedIn() && (resource.data.userId == request.auth.uid || isAdminOrSubAdmin());\n      allow create: if isLoggedIn();\n      allow update, delete: if isAdminOrSubAdmin();\n    }",
  `    match /transactions/{docId} {
      allow read: if isLoggedIn() && (resource.data.userId == request.auth.uid || isAdminOrSubAdmin());
      allow create: if isLoggedIn() && 
                    request.resource.data.userId == request.auth.uid &&
                    (request.resource.data.type != 'withdrawal' || 
                      (request.resource.data.amount > 0 && 
                       get(/databases/$(database)/documents/wallets/$(request.auth.uid)).data.bonusBalance >= request.resource.data.amountUsdt));
      allow update, delete: if isAdminOrSubAdmin();
    }`
);

fs.writeFileSync('/home/user/webapp/firestore.rules', rules);
console.log("Fixed transactions rule");
