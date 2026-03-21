const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

// Find the date filter line
const target = "const datePicker = document.getElementById('txDateFilter');";
const replacement = `const datePicker = document.getElementById('txDateFilter');
    if (datePicker && !datePicker.value) {
      const today = new Date();
      // KST timezone adjustment
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      datePicker.value = \`\${yyyy}-\${mm}-\${dd}\`;
    }`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log("Date picker default to today added.");
