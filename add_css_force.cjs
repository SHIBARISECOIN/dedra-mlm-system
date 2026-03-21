const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Ensure body doesn't have pointer-events:none or user-select:none dynamically applied
const cssFix = `
<style>
  #forcePwModal, #forcePwModal * {
    pointer-events: auto !important;
    user-select: auto !important;
    -webkit-user-select: auto !important;
  }
</style>
`;

if (!html.includes('id="forcePwModal"')) {
    console.log('modal not found');
} else if (!html.includes('#forcePwModal * {')) {
    html = html.replace('</head>', cssFix + '</head>');
    fs.writeFileSync(indexHtmlPath, html);
    console.log('Added CSS fix');
}
