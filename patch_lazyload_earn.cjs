const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

// EARN 영역 최적화 (myInvestments 로드 최소화 및 캐시 도입)
const earnMod = `// --- EARN 캐시 변수 추가 ---
window._cachedMyInvestments = null;

async function loadHomeEarn() {
  setTimeout(window.initLiveTransactionMarquee, 500);
  const listEl = document.getElementById('homeEarnList');
  if (!listEl) return;

  try {
    const { collection, getDocs, query, where, db } = window.FB;

    // 상품 로드 (캐시 활용)
    if (!productsCache || !productsCache.length) {
      const snap = await getDocs(collection(db, 'products'));
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      productsCache = allDocs
        .filter(p => !p.type || p.type === 'investment')
        .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));
    }

    // 내 활성 투자 로드 (캐시 활용)
    let myInvestments = window._cachedMyInvestments || [];
    
    if (currentUser && !window._cachedMyInvestments) {
      try {
        const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
        const iSnap = await getDocs(q);
        myInvestments = iSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => inv.status === 'active');
        window._cachedMyInvestments = myInvestments;
      } catch(e) { /* 조용히 */ }
    }

    // 렌더링을 DOM 업데이트 최소화하여 실행
    if (listEl.innerHTML.includes('earn-skeleton')) {
      renderHomeEarn(productsCache, myInvestments);
      renderHomeInvestCards(myInvestments, productsCache);
      updateTodayEarnSummary(myInvestments);
    } else {
      // 이미 렌더링된 상태라면 백그라운드에서 조용히 데이터만 갱신 (리렌더링 깜빡임 방지)
      setTimeout(() => {
        renderHomeEarn(productsCache, myInvestments);
        renderHomeInvestCards(myInvestments, productsCache);
        updateTodayEarnSummary(myInvestments);
      }, 500);
    }
  } catch (e) {
    console.error('[EARN] 상품 로드 오류:', e);
    if (e && e.code) { listEl.innerHTML = \`<div style="font-size:11px;color:red;text-align:center;padding:12px 0;">Error: \${e.message}</div>\`; return; }
    listEl.innerHTML = \`<div style="font-size:11px;color:rgba(255,255,255,0.35);text-align:center;padding:12px 0;">\${t('emptyProducts')}</div>\`;
  }
}`;

appJs = appJs.replace(/async function loadHomeEarn\(\) \{[\s\S]*?updateTodayEarnSummary\(myInvestments\);\s*\} catch \(e\) \{[\s\S]*?\}\s*\}/, earnMod);

// 투자가 발생했을 때 캐시 무효화 하도록 submitInvest 등도 수정
appJs = appJs.replace(/closeModal\('investModal'\);/g, "window._cachedMyInvestments = null; closeModal('investModal');");
appJs = appJs.replace(/closeModal\('reinvestModal'\);/g, "window._cachedMyInvestments = null; closeModal('reinvestModal');");

fs.writeFileSync('public/static/app.js', appJs);
console.log('patched EARN logic');
