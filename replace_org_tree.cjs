const fs = require('fs');

let content = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

const startTag = 'window.renderCaveTree = async function() {';
const endTag = 'window.handleCaveNodeClick = function(id, name, rank, isPathNode, pathIndex, refCount = 0) {\n   if (isPathNode) {\n      // Clicked a node already in the path -> truncate path to this node\n      if (pathIndex === window.cavePath.length - 1) return; // Already the tip\n      window.cavePath = window.cavePath.slice(0, pathIndex + 1);\n      window.renderCaveTree();\n   } else {\n      // Clicked a child -> add to path\n      window.cavePath.push({ id, name, rank, referralCount: refCount });\n      window.renderCaveTree();\n   }\n};\n';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag) + endTag.length;

if (startIndex === -1 || content.indexOf(endTag) === -1) {
    console.error("Could not find start or end tag.");
    process.exit(1);
}

const replacement = `window.renderCaveTree = async function() {
  const treeEl = document.getElementById('orgTree');
  if (!treeEl) return;
  const wrap = document.getElementById('orgChartWrap');
  if (wrap) {
      wrap.style.cursor = 'auto'; // Disable dragging grab cursor
      // Reset transform so it doesn't stay offset from old draggable map
      treeEl.style.transform = 'translate(0px, 0px)';
  }
  
  treeEl.innerHTML = \`<div class="spinner" style="margin:40px auto;"></div>\`;

  try {
    const { collection, getDocs, db } = window.FB;
    
    // Fetch all users and wallets
    const [usersSnap, walletsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'wallets'))
    ]);
    
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const walletMap = {};
    walletsSnap.docs.forEach(d => {
        walletMap[d.id] = d.data().totalInvested || d.data().totalInvest || 0;
    });
    
    const childrenMap = {};
    const userMap = {};
    allUsers.forEach(u => {
        childrenMap[u.id] = [];
        userMap[u.id] = u;
    });
    allUsers.forEach(u => {
        if (u.referredBy && childrenMap[u.referredBy]) {
            childrenMap[u.referredBy].push(u.id);
        }
    });
    
    const nodeStats = {};
    allUsers.forEach(u => {
        nodeStats[u.id] = {
            selfInvest: walletMap[u.id] || 0,
            networkSales: 0,
            directRefs: childrenMap[u.id].length
        };
    });
    
    const computeNetworkSales = (uid) => {
        if (nodeStats[uid].networkSalesComputed) return nodeStats[uid].networkSales;
        let sales = 0;
        const children = childrenMap[uid] || [];
        for (const childId of children) {
            sales += nodeStats[childId].selfInvest;
            sales += computeNetworkSales(childId);
        }
        nodeStats[uid].networkSales = sales;
        nodeStats[uid].networkSalesComputed = true;
        return sales;
    };
    
    allUsers.forEach(u => computeNetworkSales(u.id));
    
    window.fullOrgData = { userMap, childrenMap, nodeStats };

    const getMaxDepth = (rank) => {
       const r = (rank || 'g0').toLowerCase();
       if (r === 'g0') return 1;
       if (r === 'g1') return 2;
       if (r === 'g2') return 3;
       if (r === 'g3') return 5;
       if (r === 'g4') return 10;
       return 999;
    };
    window.orgMaxDepth = getMaxDepth(userData?.rank || 'G0');
    
    const rootId = currentUser.uid;
    treeEl.innerHTML = \`<div style="text-align:left; padding: 10px 0; max-width:600px; margin:0 auto;">\` + buildOrgNodeHtml(rootId, 0) + \`</div>\`;
    
  } catch(e) {
      console.error(e);
      treeEl.innerHTML = '<div style="color:#ef4444;font-size:13px;text-align:center;padding:20px;">데이터를 불러오지 못했습니다. (' + e.message + ')</div>';
  }
};

window.buildOrgNodeHtml = function(uid, currentDepth) {
    const data = window.fullOrgData;
    const u = data.userMap[uid];
    if (!u) return '';
    
    const stats = data.nodeStats[uid];
    const children = data.childrenMap[uid] || [];
    
    const displayId = u.username || (u.email ? u.email.split('@')[0] : (u.id ? u.id.substring(0, 8).toUpperCase() : '***'));
    const avatarUrl = \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${displayId}&backgroundColor=transparent\`;
    
    const rankColorMap = {
        g0: '#4b5563', g1: '#3b82f6', g2: '#10b981', g3: '#059669', g4: '#d97706',
        g5: '#ea580c', g6: '#e11d48', g7: '#dc2626', g8: '#9333ea', g9: '#7c3aed',
        g10: 'linear-gradient(45deg, #fbbf24, #f59e0b, #d97706)'
    };
    const cHex = rankColorMap[(u.rank||'g0').toLowerCase()] || '#4b5563';
    
    const isMe = uid === currentUser.uid;
    const bg = isMe ? 'rgba(157, 78, 221, 0.1)' : 'rgba(30, 30, 40, 0.6)';
    const border = isMe ? '1px solid rgba(157, 78, 221, 0.4)' : '1px solid rgba(255,255,255,0.05)';
    
    const hasChildren = children.length > 0;
    
    const formatUSDT = (val) => Number(val).toLocaleString(undefined, {maximumFractionDigits:2});
    
    // Check if there are unread messages for this path
    const hasUnread = window.unreadChatPaths && window.unreadChatPaths.has(u.id) && !isMe;
    const badgeHtml = hasUnread ? \`<div style="position:absolute; top:-4px; left:-4px; width:12px; height:12px; background:#ef4444; border-radius:50%; animation: pulse 2s infinite; z-index: 5;"></div>\` : '';

    return \`
      <div class="org-list-item" style="margin-bottom: 8px;">
         <div style="background:\${bg}; border:\${border}; border-radius:12px; padding:14px; cursor:\${hasChildren ? 'pointer' : 'default'}; position:relative; display:flex; align-items:center; gap:12px; transition: background 0.2s;" onclick="\${hasChildren ? \`window.toggleOrgNode('\${uid}', \${currentDepth})\` : ''}">
             \${badgeHtml}
             <div style="width:46px; height:46px; border-radius:50%; background:rgba(255,255,255,0.1); overflow:hidden; flex-shrink:0;">
                 <img src="\${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />
             </div>
             
             <div style="flex:1; overflow:hidden;">
                 <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
                     <span style="font-weight:bold; color:#fff; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">\${displayId}</span>
                     <span style="color:#94a3b8; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100px;">[ \${u.name || ''} ]</span>
                     <span style="background:\${cHex}; color:#fff; padding:2px 6px; border-radius:6px; font-size:11px; font-weight:bold;">★ \${(u.rank||'G0').replace('G','')}</span>
                     <span style="background:rgba(255,255,255,0.1); color:#cbd5e1; padding:2px 6px; border-radius:6px; font-size:11px;">👥 \${stats.directRefs}</span>
                 </div>
                 <div style="color:#cbd5e1; font-size:12px; display:flex; gap:12px; flex-wrap:wrap;">
                     <div>본인매출 : <span style="color:#10b981; font-weight:700;">\${formatUSDT(stats.selfInvest)}</span> USDT</div>
                     <div>하부매출 : <span style="color:#3b82f6; font-weight:700;">\${formatUSDT(stats.networkSales)}</span> USDT</div>
                 </div>
             </div>
             
             \${hasChildren ? \`
             <div style="color:#64748b; font-size:14px; padding-left:8px;">
                 <i class="fas fa-chevron-down" id="icon-\${uid}" style="transition: transform 0.3s;"></i>
             </div>
             \` : ''}
         </div>
         
         <div id="children-\${uid}" style="display:none; padding-left:14px; margin-top:8px; border-left:2px solid rgba(157,78,221,0.3); margin-left:22px;">
             <!-- Children injected here -->
         </div>
      </div>
    \`;
};

window.toggleOrgNode = function(uid, currentDepth) {
    const childrenDiv = document.getElementById(\`children-\${uid}\`);
    const icon = document.getElementById(\`icon-\${uid}\`);
    if (!childrenDiv) return;
    
    if (childrenDiv.style.display === 'none') {
        // Check depth limit
        if (currentDepth + 1 > window.orgMaxDepth) {
             const userRank = userData?.rank || 'G0';
             showToast(\`현재 \${userRank} 직급은 \${window.orgMaxDepth}대까지만 열람할 수 있습니다.\`, 'warning');
             return;
        }
        
        // Render children if empty
        if (childrenDiv.innerHTML.trim() === '<!-- Children injected here -->') {
            const data = window.fullOrgData;
            const children = data.childrenMap[uid] || [];
            let html = '';
            children.forEach(childId => {
                html += buildOrgNodeHtml(childId, currentDepth + 1);
            });
            childrenDiv.innerHTML = html;
        }
        
        childrenDiv.style.display = 'block';
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        childrenDiv.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
};

window.showNodeActionModal = function() {}; // Kept to avoid errors
window.doNodeAction = function() {};
window.handleCaveNodeClick = function() {};
`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync('/home/user/webapp/public/static/app.js', content);
console.log('app.js patched successfully!');
