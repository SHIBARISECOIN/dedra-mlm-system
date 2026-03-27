const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `  document.getElementById('depositModal').classList.remove('hidden');
};`;

const replacement = `  document.getElementById('depositModal').classList.remove('hidden');
  
  // --- Bear Market Cushion Logic ---
  try {
    const { doc, getDoc, db } = window.FB;
    let isEligibleForBonus = true;
    if (walletData && (walletData.totalWithdrawal || 0) > 0) {
      isEligibleForBonus = false;
    }
    
    // UI Element for Bear Market Warning/Notice
    let bearBanner = document.getElementById('bearMarketBanner');
    if (!bearBanner) {
      bearBanner = document.createElement('div');
      bearBanner.id = 'bearMarketBanner';
      bearBanner.style.margin = '0 0 15px 0';
      bearBanner.style.padding = '12px';
      bearBanner.style.borderRadius = '8px';
      bearBanner.style.fontSize = '12px';
      bearBanner.style.fontWeight = 'bold';
      bearBanner.style.display = 'none';
      
      const modalBody = document.querySelector('#depositModal .modal-body');
      if (modalBody && modalBody.firstChild) {
        modalBody.insertBefore(bearBanner, modalBody.firstChild);
      }
    }
    
    if (!isEligibleForBonus) {
      bearBanner.style.display = 'none';
      // user is excluded
    } else {
      const evSnap = await getDoc(doc(db, 'settings', 'bearMarketEvent'));
      if (evSnap.exists()) {
        const evData = evSnap.data();
        const now = new Date();
        let isWithinTime = false;
        if (evData.enabled) {
          if (evData.startDate && evData.endDate) {
            const sDate = new Date(evData.startDate);
            const eDate = new Date(evData.endDate);
            if (now >= sDate && now <= eDate) isWithinTime = true;
          } else if (evData.endDate) {
            const eDate = new Date(evData.endDate);
            if (now <= eDate) isWithinTime = true;
          } else {
            isWithinTime = true;
          }
        }
        
        if (isWithinTime) {
          const priceSnap = await getDoc(doc(db, 'settings', 'deedraPrice'));
          if (priceSnap.exists()) {
            const pData = priceSnap.data();
            const drop = parseFloat(pData.priceChange24h || 0);
            if (drop < 0) {
              const bonusPct = Math.abs(drop);
              bearBanner.innerHTML = \`📉 <strong>하락장 보상 이벤트 진행중!</strong><br><span style="color:#ef4444;font-size:14px;">현재 하락률 \${bonusPct.toFixed(2)}%</span> 만큼 입금 시 USDT 보너스가 추가 지급됩니다!\`;
              bearBanner.style.background = '#fee2e2';
              bearBanner.style.border = '1px solid #fca5a5';
              bearBanner.style.color = '#991b1b';
              bearBanner.style.display = 'block';
            } else {
              bearBanner.style.display = 'none';
            }
          }
        } else {
          bearBanner.style.display = 'none';
        }
      } else {
        bearBanner.style.display = 'none';
      }
    }
  } catch(e) { console.error("Bear market ui err:", e); }
};`;

code = code.replace(target, replacement);
fs.writeFileSync('public/static/app.js', code);

console.log("app.js patched for Bear Market Cushion UI");
