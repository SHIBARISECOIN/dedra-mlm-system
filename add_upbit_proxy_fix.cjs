const fs = require('fs');
let src = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');

const proxyRoute = `
// Upbit Ticker Proxy
app.get('/api/upbit-ticker', async (c) => {
  try {
    const markets = c.req.query('markets');
    if (!markets) return c.json([]);
    
    const resp = await fetch('https://api.upbit.com/v1/ticker?markets=' + markets, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    if (!resp.ok) return c.json([]);
    
    const data = await resp.json();
    return c.json(data);
  } catch (err) {
    return c.json([]);
  }
});
`;

if (!src.includes('/api/upbit-ticker')) {
  src = src.replace('export default {', proxyRoute + '\nexport default {');
  fs.writeFileSync('/home/user/webapp/src/index.tsx', src, 'utf8');
  console.log('Upbit proxy added to backend successfully');
}
