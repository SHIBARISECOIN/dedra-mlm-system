const fs = require('fs');
const html = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

const regex = /<script>([\s\S]*?)<\/script>/g;
let match;
while ((match = regex.exec(html)) !== null) {
  try {
    new Function(match[1]);
  } catch (e) {
    console.log("Syntax error found in a script tag!");
    // Find the approximate line number
    const upToError = html.substring(0, match.index);
    const lineNum = upToError.split('\n').length;
    console.log("Approx line number: ", lineNum);
    console.log(e);
  }
}
