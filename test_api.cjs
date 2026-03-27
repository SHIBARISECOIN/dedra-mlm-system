const https = require('https');
https.get('https://deedra.pages.dev/api/news-digest', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.parse(data).items[0]));
}).on('error', err => console.log(err));
