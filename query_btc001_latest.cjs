const fs = require('fs');
const http = require('http');

http.get('http://localhost:3000/api/admin/check-reconstruct', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.slice(0, 100)));
});
