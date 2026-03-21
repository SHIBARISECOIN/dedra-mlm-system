const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const regex = /\/\/ ===== 실시간 암호화폐 시세 \(Upbit\) =====[\s\S]*?setTimeout\(startUpbitTicker, 2000\);/;

const newTickerCode = `// ===== 실시간 암호화폐 시세 (Upbit) =====
function startUpbitTicker() {
  const container = document.getElementById('upbitTickerContainer');
  if (!container) return;
  
  const coinList = [
    {id:'KRW-BTC', sym:'BTC', name:'Bitcoin'},
    {id:'KRW-ETH', sym:'ETH', name:'Ethereum'},
    {id:'KRW-SOL', sym:'SOL', name:'Solana'},
    {id:'KRW-XRP', sym:'XRP', name:'Ripple'},
    {id:'KRW-DOGE', sym:'DOGE', name:'Dogecoin'},
    {id:'KRW-ADA', sym:'ADA', name:'Cardano'},
    {id:'KRW-AVAX', sym:'AVAX', name:'Avalanche'},
    {id:'KRW-DOT', sym:'DOT', name:'Polkadot'},
    {id:'KRW-LINK', sym:'LINK', name:'Chainlink'},
    {id:'KRW-TRX', sym:'TRX', name:'Tron'},
    {id:'KRW-BCH', sym:'BCH', name:'Bitcoin Cash'},
    {id:'KRW-ETC', sym:'ETC', name:'Ethereum Classic'},
    {id:'KRW-SUI', sym:'SUI', name:'Sui'},
    {id:'KRW-STX', sym:'STX', name:'Stacks'},
    {id:'KRW-SEI', sym:'SEI', name:'Sei'},
    {id:'KRW-ARB', sym:'ARB', name:'Arbitrum'},
    {id:'KRW-OP', sym:'OP', name:'Optimism'},
    {id:'KRW-NEAR', sym:'NEAR', name:'NEAR Protocol'},
    {id:'KRW-APT', sym:'APT', name:'Aptos'},
    {id:'KRW-EOS', sym:'EOS', name:'EOS'},
    {id:'KRW-SHIB', sym:'SHIB', name:'Shiba Inu'},
    {id:'KRW-SAND', sym:'SAND', name:'The Sandbox'},
    {id:'KRW-MANA', sym:'MANA', name:'Decentraland'},
    {id:'KRW-AXS', sym:'AXS', name:'Axie Infinity'}
  ];
  
  let pageIndex = 0;
  let cachedData = {};
  
  async function fetchPrices() {
    try {
      const ids = coinList.map(c => c.id).join(',');
      const res = await fetch('https://api.upbit.com/v1/ticker?markets=' + ids);
      const data = await res.json();
      
      data.forEach(ticker => {
        cachedData[ticker.market] = ticker;
      });
      renderTickers();
    } catch(e) {
      console.warn('Upbit ticker fetch error:', e);
    }
  }
  
  function renderTickers() {
    if (Object.keys(cachedData).length === 0) return;
    
    // Rotate every fetch (every 5 seconds) -> move pageIndex by 1
    pageIndex = (pageIndex + 1) % 3; // 24 coins / 8 per page = 3 pages
    
    const startIndex = pageIndex * 8;
    const currentCoins = coinList.slice(startIndex, startIndex + 8);
    
    let html = '';
    currentCoins.forEach(coin => {
      const ticker = cachedData[coin.id];
      if (!ticker) return;
      
      const isUp = ticker.change === 'RISE';
      const isDown = ticker.change === 'FALL';
      const color = isUp ? '#ef4444' : isDown ? '#3b82f6' : '#94a3b8';
      const sign = isUp ? '+' : '';
      const pct = (ticker.signed_change_rate * 100).toFixed(2);
      
      let priceStr = ticker.trade_price.toLocaleString();
      if (ticker.trade_price < 100) {
        priceStr = ticker.trade_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});
      }
      
      html += \`
        <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); animation: fadeIn 0.5s ease;">
          <div style="font-size:10px; color:#94a3b8; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fff; font-weight:700; font-size:12px;">\${coin.sym}</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%; text-align:right;">\${coin.name}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <span style="font-size:14px; font-weight:800; color:\${color}">\${priceStr}</span>
            <span style="font-size:11px; font-weight:600; color:\${color}">\${sign}\${pct}%</span>
          </div>
        </div>
      \`;
    });
    
    container.innerHTML = html;
  }
  
  // Inject fadeIn animation CSS if not exists
  if (!document.getElementById('tickerAnimStyle')) {
    const style = document.createElement('style');
    style.id = 'tickerAnimStyle';
    style.innerHTML = '@keyframes fadeIn { from { opacity: 0.3; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }';
    document.head.appendChild(style);
  }
  
  fetchPrices();
  setInterval(fetchPrices, 5000);
}

setTimeout(startUpbitTicker, 2000);`;

if(appJs.match(regex)) {
  appJs = appJs.replace(regex, newTickerCode);
  fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs, 'utf8');
  console.log('Upbit ticker successfully replaced.');
} else {
  console.log('Regex not matched!');
}
