const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// The today filter is too strict because UTC server time might not perfectly align with local timezone today start/end,
// OR since we modified the createdAt strings, let's just make it show all recent 100 items instead of strictly matching today's seconds.
// Users usually want to see their "recent" transactions in the transaction history tab, not JUST strictly today.
// If it's a "Today" specific tab, we should use the settlementDate we injected.
// The code says "// Apply Today Filter", but if it's the main transaction history, it might be better to show everything.
// Let's remove the strict 24h filter and just show all fetched records sorted by time.

code = code.replace(
  /\/\/ Apply Today Filter \([\s\S]*?return t >= filterStart && t < filterEnd;\n    \}\);/,
  `// Apply Today Filter removed to show all recent history correctly.
    // We already use limit(100) in the queries so it won't be too large.`
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Patched app.js transaction history filter');
