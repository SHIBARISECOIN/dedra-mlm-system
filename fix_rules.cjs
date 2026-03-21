const fs = require('fs');
let rules = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');

rules = rules.replace(
  "    match /users/{userId} {\n      allow read: if isLoggedIn();\n      allow write: if isLoggedIn() && (request.auth.uid == userId || isAdminOrSubAdmin());\n    }",
  `    match /users/{userId} {
      allow read: if isLoggedIn();
      allow create: if isLoggedIn() && request.auth.uid == userId;
      allow update: if isLoggedIn() && (
        (request.auth.uid == userId && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'rank', 'status', 'totalInvest', 'totalEarnings'])) ||
        isAdminOrSubAdmin()
      );
      allow delete: if isAdminOrSubAdmin();
    }`
);

fs.writeFileSync('/home/user/webapp/firestore.rules', rules);
console.log("Fixed users rule");
