const fs = require('fs');
const htmlFile = '/home/user/webapp/public/index.html';
const jsFile = '/home/user/webapp/public/static/app.js';

// Update HTML
let html = fs.readFileSync(htmlFile, 'utf8');
const dexBody = `
    <div id="dexIframeContainer" style="flex:1; width:100%; position:relative;">
      <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#94a3b8; font-size:14px; text-align:center;">
        <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:12px; color:#10b981;"></i><br>
        Raydium 로딩 중...
      </div>
      <iframe id="dexIframe" src="" style="width:100%; height:100%; border:none; position:relative; z-index:2; background:transparent;" allow="clipboard-read; clipboard-write"></iframe>
    </div>
  </div>
</div>`;

html = html.replace(/<button onclick="closeModal\('dexModal'\)".*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>/s, `<button onclick="closeModal('dexModal')" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:28px; height:28px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>\n    </div>` + dexBody);
fs.writeFileSync(htmlFile, html, 'utf8');

// Update JS
let js = fs.readFileSync(jsFile, 'utf8');
js = js.replace(/window\.openDexSwap = function\(type\) \{[\s\S]*?window\.open\(url, '_blank'\);\n\};/s, 
`window.openDexSwap = function(type) {
  const usdtMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const ddraMint = "DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv";
  
  let inputMint = type === 'buy' ? usdtMint : ddraMint;
  let outputMint = type === 'buy' ? ddraMint : usdtMint;
  
  const url = \`https://raydium.io/swap/?inputMint=\${inputMint}&outputMint=\${outputMint}&fixed=in\`;
  
  const modal = document.getElementById('dexModal');
  const iframe = document.getElementById('dexIframe');
  
  if (modal && iframe) {
    iframe.src = url;
    modal.classList.remove('hidden');
  } else {
    window.open(url, '_blank');
  }
};`);
fs.writeFileSync(jsFile, js, 'utf8');

console.log("DEX iframe fixed.");
