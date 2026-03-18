const fs = require('fs');

let content = fs.readFileSync('public/static/admin.html', 'utf8');

const badString = `</head><body>\${content.innerHTML}<script>
  setTimeout(() => {
    if (typeof _trc20AutoPollActive !== "undefined" && _trc20AutoPollActive) {
      window.toggleTrc20AutoPoll(true);
    }
  }, 1000);
</script>
</body></html>\`);`;

const goodString = `</head><body>\${content.innerHTML}</body></html>\`);`;

content = content.replace(badString, goodString);

fs.writeFileSync('public/static/admin.html', content);
console.log('Fixed admin.html');
