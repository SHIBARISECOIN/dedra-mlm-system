const fs = require('fs');
let app = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const codeToInsert = `
// ===== 실시간 암호화폐 시세 (Upbit) =====
function startUpbitTicker() {
  const container = document.getElementById('upbitTickerContainer');
  if (!container) return;
  
  const coins = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP'];
  
  async function fetchPrices() {
    try {
      const res = await fetch('https://api.upbit.com/v1/ticker?markets=' + coins.join(','));
      const data = await res.json();
      
      let html = '';
      data.forEach(ticker => {
        const nameMap = {
          'KRW-BTC': 'Bitcoin',
          'KRW-ETH': 'Ethereum',
          'KRW-SOL': 'Solana',
          'KRW-XRP': 'Ripple'
        };
        const symMap = {
          'KRW-BTC': 'BTC',
          'KRW-ETH': 'ETH',
          'KRW-SOL': 'SOL',
          'KRW-XRP': 'XRP'
        };
        const isUp = ticker.change === 'RISE';
        const isDown = ticker.change === 'FALL';
        const color = isUp ? '#ef4444' : isDown ? '#3b82f6' : '#94a3b8';
        const sign = isUp ? '+' : '';
        const pct = (ticker.signed_change_rate * 100).toFixed(2);
        
        html += \`
          <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:11px; color:#94a3b8; margin-bottom:4px; display:flex; justify-content:space-between;">
              <span style="color:#fff; font-weight:700;">\${symMap[ticker.market]}</span>
              <span>\${nameMap[ticker.market]}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <span style="font-size:15px; font-weight:800; color:\${color}">\${ticker.trade_price.toLocaleString()}</span>
              <span style="font-size:11px; font-weight:600; color:\${color}">\${sign}\${pct}%</span>
            </div>
          </div>
        \`;
      });
      container.innerHTML = html;
    } catch(e) {
      console.warn('Upbit ticker fetch error:', e);
    }
  }
  
  fetchPrices();
  setInterval(fetchPrices, 5000);
}

// Call on init
setTimeout(startUpbitTicker, 2000);
`;

app += '\n' + codeToInsert;

fs.writeFileSync('/home/user/webapp/public/static/app.js', app);
console.log("Upbit ticker added.");
