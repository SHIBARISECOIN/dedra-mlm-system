const fs = require('fs');
let app = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const codeToInsert = `
// ===== DEX Swap Modal =====
window.openDexSwap = function(type) {
  const modal = document.getElementById('dexModal');
  if (modal) {
    modal.classList.remove('hidden');
    // If Jupiter is included but not initialized, we can just show it.
    // Ideally it would pre-fill buy/sell based on the type.
    if (!window.jupiterInitialized) {
      const term = document.getElementById('jupiter-terminal');
      if (term && typeof window.Jupiter !== 'undefined') {
        try {
          window.Jupiter.init({
            displayMode: "integrated",
            integratedTargetId: "jupiter-terminal",
            endpoint: "https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY_HERE",
            defaultExplorer: "Solscan",
          });
          window.jupiterInitialized = true;
        } catch(e) { console.error('Jupiter init err', e); }
      } else {
        if(term) term.innerHTML = '<div style="padding:20px; color:#fff; text-align:center;">DEX 터미널을 불러올 수 없습니다.</div>';
      }
    }
  } else {
    showToast('지원하지 않는 기능입니다.', 'info');
  }
};
`;

app += '\n' + codeToInsert;

fs.writeFileSync('/home/user/webapp/public/static/app.js', app);
console.log("Dex swap added.");
