const fs = require('fs');
const path = require('path');

const version = new Date().getTime(); // Unix timestamp

const filesToUpdate = [
  path.join(__dirname, '../public/static/admin.html'),
  path.join(__dirname, '../public/index.html')
];

for (const filePath of filesToUpdate) {
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/(\.js\?v=)\w+/g, `$1${version}`);
  content = content.replace(/(\.css\?v=)\w+/g, `$1${version}`);

  fs.writeFileSync(filePath, content);
  console.log(`Updated cache version to ${version} in ${filePath}`);
}
