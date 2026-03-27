const fs = require('fs');
try {
  eval(fs.readFileSync('public/static/app.js', 'utf8'));
} catch (e) {
  console.log(e.name, e.message, e.lineNumber, e.lineNumber || 'Unknown line');
  // Log the lines around the error
  const stack = e.stack.split('\n');
  console.log(stack.slice(0, 5).join('\n'));
}
