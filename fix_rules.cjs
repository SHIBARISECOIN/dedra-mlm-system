const fs = require('fs');
let rules = fs.readFileSync('/home/user/webapp/firestore.rules', 'utf8');

// Replace investments read rule
rules = rules.replace(
  /match \/investments\/\{docId\} \{\n      allow read: if isLoggedIn\(\) && \(resource\.data\.userId == request\.auth\.uid \|\| isAdminOrSubAdmin\(\)\);/g,
  'match /investments/{docId} {\n      allow read: if isLoggedIn();'
);

// Replace wallets read rule
rules = rules.replace(
  /match \/wallets\/\{userId\} \{\n      allow read, write: if isLoggedIn\(\) && \(request\.auth\.uid == userId \|\| isAdminOrSubAdmin\(\)\);/g,
  'match /wallets/{userId} {\n      allow read: if isLoggedIn();\n      allow write: if isLoggedIn() && (request.auth.uid == userId || isAdminOrSubAdmin());'
);

// Replace bonuses read rule (we query bonuses by fromUserId)
rules = rules.replace(
  /match \/bonuses\/\{docId\} \{\n      allow read: if isLoggedIn\(\) && \(resource\.data\.userId == request\.auth\.uid \|\| isAdminOrSubAdmin\(\)\);/g,
  'match /bonuses/{docId} {\n      allow read: if isLoggedIn();'
);

fs.writeFileSync('/home/user/webapp/firestore.rules', rules);
console.log("rules fixed");
