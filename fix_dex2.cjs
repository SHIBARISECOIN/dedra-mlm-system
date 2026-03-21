const fs = require('fs');
let app = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const newDex = `
// ===== DEX Swap Modal =====
window.openDexSwap = function(type) {
  const modal = document.getElementById('dexModal');
  if (!modal) {
    showToast('지원하지 않는 기능입니다.', 'info');
    return;
  }
  
  modal.classList.remove('hidden');
  
  const term = document.getElementById('jupiter-terminal');
  if (!term) return;

  function initJupiter() {
    if (window.jupiterInitialized) return;
    try {
      window.Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: "jupiter-terminal",
        endpoint: "https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY_HERE",
        defaultExplorer: "Solscan",
        formProps: {
          fixedInputMint: false,
          fixedOutputMint: false,
          swapMode: "ExactIn",
          initialInputMint: type === 'buy' ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" : "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // USDT to DEEDRA (or DEEDRA to USDT) - mocked DEEDRA address
          initialOutputMint: type === 'buy' ? "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        },
      });
      window.jupiterInitialized = true;
    } catch(e) { 
      console.error('Jupiter init err', e); 
      term.innerHTML = '<div style="padding:20px; color:#fff; text-align:center;">DEX 터미널 초기화 실패</div>';
    }
  }

  if (typeof window.Jupiter !== 'undefined') {
    initJupiter();
  } else {
    term.innerHTML = '<div style="padding:20px; color:#fff; text-align:center;"><i class="fas fa-spinner fa-spin"></i> DEX 터미널 로딩 중...</div>';
    const script = document.createElement('script');
    script.src = 'https://terminal.jup.ag/main-v3.js';
    script.onload = () => {
      term.innerHTML = '';
      initJupiter();
    };
    script.onerror = () => {
      term.innerHTML = '<div style="padding:20px; color:#fff; text-align:center;">DEX 스크립트를 불러올 수 없습니다.</div>';
    };
    document.body.appendChild(script);
  }
};
`;

const regex = /\/\/ ===== DEX Swap Modal =====[\s\S]*?(?=(\n\/\/|$))/;
app = app.replace(regex, newDex.trim());

fs.writeFileSync('/home/user/webapp/public/static/app.js', app);
console.log("Dex swap updated.");
