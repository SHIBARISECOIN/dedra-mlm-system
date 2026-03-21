const fs = require('fs');
let html = fs.readFileSync('public/static/admin.html', 'utf8');

const regex = /listEl\.innerHTML = records\.map\(rec => \`[\s\S]*?<\/div>\`\)\.join\(''\);/;
const replaceStr = `
    listEl.innerHTML = records.map(rec => {
      let dtHTML = '';
      if (rec.details && typeof rec.details === 'object') {
        const d = rec.details;
        dtHTML = \`
          <div style="margin-top:10px;padding:10px;background:#fff;border-radius:8px;border:1px dashed #e2e8f0;">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;font-weight:600;">[세부 지급 내역]</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:8px;">
              <div style="padding:6px;background:#f8fafc;border-radius:6px;text-align:center;">
                <div style="font-size:10px;color:#64748b;">데일리 수익(ROI)</div>
                <div style="font-weight:700;color:#0f172a;font-size:12px;">\${(d.roiAmount||0).toFixed(2)} USDT</div>
              </div>
              <div style="padding:6px;background:#f8fafc;border-radius:6px;text-align:center;">
                <div style="font-size:10px;color:#64748b;">추천 수당</div>
                <div style="font-weight:700;color:#0f172a;font-size:12px;">\${(d.directBonus||0).toFixed(2)} USDT</div>
              </div>
              <div style="padding:6px;background:#f8fafc;border-radius:6px;text-align:center;">
                <div style="font-size:10px;color:#64748b;">직급 롤업</div>
                <div style="font-weight:700;color:#0f172a;font-size:12px;">\${(d.rankRollup||0).toFixed(2)} USDT</div>
              </div>
              <div style="padding:6px;background:#f8fafc;border-radius:6px;text-align:center;">
                <div style="font-size:10px;color:#64748b;">직급 매칭</div>
                <div style="font-weight:700;color:#0f172a;font-size:12px;">\${(d.rankMatching||0).toFixed(2)} USDT</div>
              </div>
            </div>
          </div>
        \`;
      }
      return \`
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px;background:#f1f5f9;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <div style="font-weight:700;font-size:14px;color:#1e293b;">
            📅 \${rec.date} 
            <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:\${rec.status==='done'?'#dcfce7':'#fef08a'};color:\${rec.status==='done'?'#166534':'#854d0e'};">\${rec.status==='done'?'완료':'진행중/기타'}</span>
          </div>
          <div style="font-size:11px;color:#64748b;">총 \${rec.totalUsers||0}건 처리 (스킵 \${rec.skippedCount||0})</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:#374151;font-weight:600;">
          <span>💰 총 정산 지급액: <span style="color:#047857;">\${(rec.totalPaid||rec.totalRoiAmount||0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} USDT</span></span>
          <span style="font-size:11px;color:#64748b;font-weight:400;margin-top:2px;">⏱ 소요시간: \${rec.duration ? (rec.duration/1000).toFixed(1)+'초' : '-'}</span>
        </div>
        \${dtHTML}
      </div>\`;
    }).join('');
`;

if (regex.test(html)) {
  html = html.replace(regex, replaceStr);
  fs.writeFileSync('public/static/admin.html', html);
  console.log("Updated admin.html settlement history renderer");
} else {
  console.log("Regex not matched!");
}
