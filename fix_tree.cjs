const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

const originalBlock = `<div style="display:flex; flex-direction:column; overflow:hidden; text-align:left;">
             <div style="font-weight:bold; font-size:14px; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${displayId}</div>
             <div style="background:\${cHex}; color:#fff; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:bold; width:fit-content; line-height:1.2;">\${n.rank||'G0'}</div>
           </div>`;

const newBlock = `<div style="display:flex; flex-direction:column; overflow:hidden; text-align:left; width:100%;">
             <div style="font-weight:bold; font-size:14px; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${displayId}</div>
             <div style="background:\${cHex}; color:#fff; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:bold; width:fit-content; line-height:1.2; margin-bottom:8px;">\${n.rank||'G0'}</div>
             <div style="font-size:11px; text-align:left; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px; margin-top:2px;">
                 <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#cbd5e1;">
                     <span>본인 매출:</span>
                     <span style="color:#10b981; font-weight:700;">\${Number(n.totalInvested || n.lockedBalance || 0).toLocaleString(undefined, {maximumFractionDigits:2})} USDT</span>
                 </div>
                 <div style="display:flex; justify-content:space-between; color:#cbd5e1;">
                     <span>라인 전체 매출:</span>
                     <span style="color:#3b82f6; font-weight:700;">\${Number(n.networkSales || 0).toLocaleString(undefined, {maximumFractionDigits:2})} USDT</span>
                 </div>
             </div>
           </div>`;

content = content.replace(originalBlock, newBlock);

// Also need to fix flex-direction of the wrapper if needed.
// Originally: display:flex; align-items:center; gap:12px;
// If we put the new block inside the right flex item, it might squish if the container isn't wide enough.
// The container has min-width or we can add it.
content = content.replace(
  /box-shadow: \${shadow}; display:flex; align-items:center; gap:12px; cursor:pointer;/g,
  "box-shadow: ${shadow}; display:flex; align-items:center; gap:12px; cursor:pointer; min-width: 240px;"
);

// We need to also fix where window.cavePath is initialized, it should have totalInvested and networkSales
content = content.replace(
  "referralCount: userData?.referralCount || userData?.totalReferrals || 0",
  "referralCount: userData?.referralCount || userData?.totalReferrals || 0,\n      totalInvested: userData?.totalInvested || 0,\n      networkSales: userData?.networkSales || 0"
);

fs.writeFileSync(file, content, 'utf8');
console.log("Org tree rendering updated.");
