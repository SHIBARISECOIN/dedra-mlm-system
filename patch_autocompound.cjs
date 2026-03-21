const fs = require('fs');

let content = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

content = content.replace(
  "const { doc, updateDoc } = window.firestore;\n    const userRef = doc(window.db, 'users', window.userData.uid);",
  "const { doc, updateDoc, db } = window.FB;\n    const userRef = doc(db, 'users', window.userData.uid);"
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', content);
console.log("Patched auto-compound in app.js");
