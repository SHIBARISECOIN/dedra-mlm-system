const fs = require('fs');

let code = fs.readFileSync('public/static/app.js', 'utf8');

const oldFunc = `async function loadCompanyWallet() {
  try {
    const { doc, getDoc, db } = window.FB;
    const snap = await getDoc(doc(db, 'settings', 'wallets'));
    const addr = document.getElementById('companyWalletAddr');
    if (snap.exists() && addr) addr.textContent = snap.data().trc20 || '주소 미설정 (관리자 문의)';
  } catch {
    const addr = document.getElementById('companyWalletAddr');
    if (addr) addr.textContent = '주소 로드 실패';
  }
}`;

const newFunc = `async function loadCompanyWallet() {
  try {
    const { doc, getDoc, db } = window.FB;
    // Check new structure first
    const snapNew = await getDoc(doc(db, 'settings', 'companyWallets'));
    const addr = document.getElementById('companyWalletAddr');
    if (!addr) return;
    
    if (snapNew.exists() && snapNew.data().wallets && snapNew.data().wallets.length > 0) {
      addr.textContent = snapNew.data().wallets[0].address || '주소 미설정 (관리자 문의)';
      return;
    }
    
    // Fallback to old structure if not found
    const snapOld = await getDoc(doc(db, 'settings', 'wallets'));
    if (snapOld.exists()) {
      addr.textContent = snapOld.data().trc20 || snapOld.data().solana || '주소 미설정 (관리자 문의)';
    } else {
      addr.textContent = '주소 미설정 (관리자 문의)';
    }
  } catch(e) {
    console.error('loadCompanyWallet error:', e);
    const addr = document.getElementById('companyWalletAddr');
    if (addr) addr.textContent = '주소 로드 실패';
  }
}`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync('public/static/app.js', code);
console.log("Patched app.js");
