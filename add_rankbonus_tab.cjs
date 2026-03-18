const fs = require('fs');
const file = '/home/user/webapp/public/index.html';
let content = fs.readFileSync(file, 'utf8');

// Add "판권 매칭" tab next to "추천 매칭"
if (!content.includes("switchTxTab('rankBonus', this)")) {
  content = content.replace(
    /<button class="tx-tab" onclick="switchTxTab\('matching', this\)">추천 매칭<\/button>/g,
    `<button class="tx-tab" onclick="switchTxTab('matching', this)">추천 매칭</button>\n              <button class="tx-tab" onclick="switchTxTab('rankBonus', this)">판권 매칭</button>`
  );
  fs.writeFileSync(file, content);
  console.log('Added rankBonus tab');
} else {
  console.log('rankBonus tab already exists');
}
