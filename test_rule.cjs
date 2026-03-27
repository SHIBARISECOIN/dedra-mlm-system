// We will deploy the rule via deploy_rules.cjs
const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(/match \/wallets\/\{userId\} \{[\s\S]*?\}\n/, `match /wallets/{userId} {
      allow read: if isLoggedIn();
      allow create: if isAdminOrSubAdmin() || (isLoggedIn() && request.auth.uid == userId);
      allow update: if isAdminOrSubAdmin() || (
        isLoggedIn() && isActiveUser() && request.auth.uid == userId &&
        request.resource.data.get('bonusBalance', 0) >= 0 &&
        request.resource.data.get('usdtBalance', 0) >= 0 &&
        request.resource.data.get('dedraBalance', 0) >= 0 &&
        request.resource.data.get('totalDeposit', 0) == resource.data.get('totalDeposit', 0) &&
        request.resource.data.get('totalEarnings', 0) == resource.data.get('totalEarnings', 0) &&
        (request.resource.data.get('usdtBalance', 0) - resource.data.get('usdtBalance', 0) <= resource.data.get('totalInvest', 0) - request.resource.data.get('totalInvest', 0)) &&
        (request.resource.data.get('bonusBalance', 0) - resource.data.get('bonusBalance', 0) <= 200) &&
        request.resource.data.get('totalWithdrawal', 0) >= resource.data.get('totalWithdrawal', 0)
      );
      allow delete: if isAdminOrSubAdmin();
    }
`);
fs.writeFileSync('firestore.rules', rules);
console.log("Updated firestore.rules locally");
