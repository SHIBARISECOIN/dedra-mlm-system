const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `window.loadNewsFeed = async function(isRefresh = false) {`;
const replace = `window.loadNewsFeed = async function(isRefresh = false) {
  console.log("=== LOAD NEWS FEED CALLED ===");
  alert("LOAD NEWS FEED CALLED");`;

code = code.replace(target, replace);
fs.writeFileSync('public/static/app.js', code);
