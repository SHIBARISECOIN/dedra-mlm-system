const fs = require('fs');
const path = require('path');

// 1. Update index.html
const indexHtmlPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Remove the date filter and download button container
const filterBlockRegex = /<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px;">[\s\S]*?<\/div>\s*(?=<!-- 거래내역 리스트 -->)/;
html = html.replace(filterBlockRegex, '');
fs.writeFileSync(indexHtmlPath, html);
console.log('Removed download button and date filter from index.html.');

// 2. Update app.js
const appJsPath = path.join(__dirname, 'public/static/app.js');
let js = fs.readFileSync(appJsPath, 'utf8');

// Remove selectedDate extraction
js = js.replace(/const dateFilterEl = document\.getElementById\('txDateFilter'\);\s*const selectedDate = dateFilterEl \? dateFilterEl\.value : '';/, '');

// Replace Date Filter with Today Filter
const applyDateFilterRegex = /\/\/ Apply Date Filter[\s\S]*?\/\/ Sort combined list descending/;
const todayFilterCode = `// Apply Today Filter (00:00 to 23:59 of current day)
    const now = new Date();
    const filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const filterEnd = filterStart + 86400;
    txs = txs.filter(item => {
      const t = getSortTime(item);
      return t >= filterStart && t < filterEnd;
    });

    // Sort combined list descending`;

if (js.match(applyDateFilterRegex)) {
    js = js.replace(applyDateFilterRegex, todayFilterCode);
    console.log('Replaced date filter logic with today filter logic.');
} else {
    console.log('Could not find Apply Date Filter block in app.js');
}

// Remove downloadTxHistory block
const downloadTxRegex = /window\.downloadTxHistory = function\(\) \{[\s\S]*?\}\s*;/g;
js = js.replace(downloadTxRegex, '');

// Remove DOMContentLoaded block for dateFilter
const domLoadedRegex = /\/\/ Add listener to date filter[\s\S]*?\}\);/;
js = js.replace(domLoadedRegex, '');

fs.writeFileSync(appJsPath, js);
console.log('Updated app.js successfully.');

