const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf-8');

const networkStart = html.indexOf('id="networkPage"');
const playStart = html.indexOf('id="playPage"');

const slice = html.substring(networkStart, playStart);
const lines = slice.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const opens = (lines[i].match(/<div/g) || []).length;
  const closes = (lines[i].match(/<\/div>/g) || []).length;
  balance += (opens - closes);
  console.log(`${i+1}: bal=${balance} | ${lines[i].trim()}`);
}
