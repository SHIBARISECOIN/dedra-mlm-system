const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

const oldModalContent = `<div class="modal-body">
      <p style="font-size:13px; color:var(--text2); margin-bottom:16px;">출금 가능한 수익금을 FREEZE 전용 지갑(원금)으로 전환하여 다시 투자 상품을 운용합니다.</p>
      <div style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="font-size:12px; color:var(--text2); margin-bottom:8px;">출금 가능 수익금</div>
        <div id="reinvestMaxAmount" style="font-size:24px; font-weight:700; color:#10b981;">0.00 <span style="font-size:14px;">USDT</span></div>
      </div>
      <div class="form-group">
        <label>재투자할 금액 (USDT)</label>`;

const newModalContent = `<div class="modal-body">
      <p style="font-size:13px; color:var(--text2); margin-bottom:16px;">출금 가능한 수익금으로 새로운 FREEZE 상품에 바로 재투자합니다.</p>
      <div style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="font-size:12px; color:var(--text2); margin-bottom:8px;">출금 가능 수익금</div>
        <div id="reinvestMaxAmount" style="font-size:24px; font-weight:700; color:#10b981;">0.00 <span style="font-size:14px;">USDT</span></div>
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label>재투자할 상품 선택 (기간)</label>
        <select id="reinvestProductSelect" class="form-input" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; border-radius:10px; padding:12px; outline:none; appearance:none;">
          <option value="">상품을 불러오는 중...</option>
        </select>
      </div>
      <div class="form-group">
        <label>재투자할 금액 (USDT)</label>`;

if (html.includes('<div class="modal-title"><i class="fas fa-sync-alt"></i> 수익금 재투자 (원금 전환)</div>')) {
    html = html.replace('<div class="modal-title"><i class="fas fa-sync-alt"></i> 수익금 재투자 (원금 전환)</div>', '<div class="modal-title"><i class="fas fa-sync-alt"></i> 수익금 재투자 (FREEZE 가입)</div>');
}

if (html.includes(oldModalContent)) {
    html = html.replace(oldModalContent, newModalContent);
    fs.writeFileSync(indexHtmlPath, html);
    console.log('Updated index.html Reinvest Modal UI');
} else {
    console.log('Could not find old Modal Content in index.html');
}
