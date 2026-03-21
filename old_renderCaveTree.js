window.renderCaveTree = async function() {
  const treeEl = document.getElementById('orgTree');
  if (!treeEl) return;
  // Reset transform and makeDraggable state when re-rendering tree
  treeEl.style.transform = 'translate(0px, 0px)';
  const wrap = document.getElementById('orgChartWrap');
  
  

  
  const colorMap = {
    g0: '#4b5563', g1: '#3b82f6', g2: '#10b981', g3: '#059669', g4: '#d97706',
    g5: '#ea580c', g6: '#e11d48', g7: '#dc2626', g8: '#9333ea', g9: '#7c3aed',
    g10: 'linear-gradient(45deg, #fbbf24, #f59e0b, #d97706)'
  };

  const renderNode = (n, isPathNode, pathIndex) => {
    const isMe = n.id === currentUser.uid;
    const cHex = colorMap[(n.rank||'g0').toLowerCase()] || '#4b5563';
    const bg = isMe ? 'linear-gradient(135deg, rgba(157, 78, 221, 0.2), rgba(30, 30, 40, 0.95))' : 'rgba(30, 30, 40, 0.95)';
    const border = isMe ? '2px solid #9d4edd' : `1px solid ${cHex.includes('gradient') ? '#f59e0b' : cHex}`;
    const displayId = n.username || (n.email ? n.email.split('@')[0] : (n.id ? n.id.substring(0, 8).toUpperCase() : '***'));
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayId}&backgroundColor=transparent`;
    const shadow = isPathNode ? '0 0 25px rgba(157, 78, 221, 0.4)' : '0 5px 15px rgba(0,0,0,0.3)';
    const opacity = isPathNode && pathIndex < window.cavePath.length - 1 ? '0.7' : '1';
    const transform = isPathNode && pathIndex < window.cavePath.length - 1 ? 'scale(0.95)' : 'scale(1)';

    // 안읽은 메시지가 있는 사용자(또는 그 하위 조직에 있는 사용자)에게 뱃지 표시
    const hasUnread = window.unreadChatPaths && window.unreadChatPaths.has(n.id) && !isMe;
    const badgeHtml = hasUnread ? `<div style="position:absolute; top:-4px; right:-4px; width:14px; height:14px; background:#ef4444; border-radius:50%; border:2px solid var(--surface); animation: pulse 2s infinite; z-index: 5;"></div>` : '';

    // 온라인 상태 표시 뱃지 (최근 2분 이내 활동)
    const isOnline = n.lastSeenAt && (Date.now() - n.lastSeenAt < 120000);
    const onlineBadge = isOnline ? `<div style="position:absolute; bottom:-2px; right:-2px; width:14px; height:14px; background:#10b981; border-radius:50%; border:2px solid #1e1e28; z-index:5; box-shadow: 0 0 5px rgba(16,185,129,0.5);"></div>` : '';

    let refCount = n.referralCount || n.totalReferrals || 0;
    if (refCount === 0 && n.children && n.children.length > 0) refCount = n.children.length;
    else if (refCount === 0 && n.hasMore) refCount = "1+";
    else if (refCount === 0 && isPathNode && pathIndex < window.cavePath.length - 1) refCount = "1+";
    
    let refBadge = '';
    if (refCount !== 0 && refCount !== '0') {
        refBadge = `<div style="position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); background:#2563eb; color:#fff; font-size:10px; font-weight:bold; padding:2px 8px; border-radius:10px; white-space:nowrap; border:1px solid #1e1e28; z-index:10; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">하위 ${refCount}명</div>`;
    }

    return `
      <div class="org-node-wrap" style="animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; position: relative;">
        ${badgeHtml}
        <div style="background:${bg}; backdrop-filter:blur(10px); border:${border}; border-radius:16px; color:#fff; padding:12px 20px; box-shadow: ${shadow}; display:flex; align-items:center; gap:12px; cursor:pointer; opacity:${opacity}; transform:${transform}; transition:all 0.3s;"
             onclick="showNodeActionModal('${n.id}', '${(displayId).replace(/'/g, `\\'`)}', '${n.rank}', ${isPathNode}, ${pathIndex}, '${refCount}')">
           <div style="position: relative; flex-shrink: 0; width:40px; height:40px;">
              <div style="width:100%; height:100%; border-radius:50%; background:rgba(255,255,255,0.1); overflow:hidden;">
                 <img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />
              </div>
              ${onlineBadge}
              ${refBadge}
           </div>
           <div style="display:flex; flex-direction:column; overflow:hidden; text-align:left;">
             <div style="font-weight:bold; font-size:14px; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayId}</div>
             <div style="background:${cHex}; color:#fff; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:bold; width:fit-content; line-height:1.2;">${n.rank||'G0'}</div>
           </div>
        </div>
      </div>
    `;
  };

  // 1. Render active path
  let html = `<div style="display:flex; flex-direction:column; align-items:center; width:100%;">`;
  
  for (let i = 0; i < window.cavePath.length; i++) {
     html += renderNode(window.cavePath[i], true, i);
     // V-connector to next node or children
     html += `<div style="width:2px; height:30px; background:linear-gradient(to bottom, #9d4edd, rgba(157,78,221,0.2)); margin:4px 0; position:relative;"></div>`;
  }

  // Loading spinner for children
  html += `<div id="caveChildrenWrap" style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; max-width:100%; padding:10px;">
              <div class="spinner" style="margin:20px;"></div>
           </div>`;
  
  html += `</div>`;
  treeEl.innerHTML = html;
  if (wrap) { try { window.makeDraggableMap(wrap, treeEl); } catch(e) { console.error(e); } }
  
  

  // 2. Fetch children for the last node in path
  const lastNode = window.cavePath[window.cavePath.length - 1];

  // --- Rank-based Depth Restriction ---
  const getMaxDepth = (rank) => {
     const r = (rank || 'g0').toLowerCase();
     if (r === 'g0') return 1;
     if (r === 'g1') return 2;
     if (r === 'g2') return 3;
     if (r === 'g3') return 5;
     if (r === 'g4') return 10;
     return 999;
  };
  
  const userRank = userData?.rank || 'G0';
  const maxDepth = getMaxDepth(userRank);
  const currentDepthToFetch = window.cavePath.length; // path length 1 fetches depth 1
  
  if (currentDepthToFetch > maxDepth) {
     const childrenWrap = document.getElementById('caveChildrenWrap');
     if (childrenWrap) {
        childrenWrap.innerHTML = `
           <div style="background:rgba(20,20,30,0.8); border:1px solid rgba(157,78,221,0.3); border-radius:16px; padding:24px 30px; text-align:center; max-width:85%; box-shadow:0 10px 30px rgba(0,0,0,0.5); backdrop-filter:blur(5px); animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
             <div style="font-size:36px; margin-bottom:12px; filter:drop-shadow(0 0 10px rgba(245,158,11,0.5));">🔒</div>
             <div style="color:#f59e0b; font-weight:800; font-size:16px; margin-bottom:8px; letter-spacing:0.5px;">${t('orgDepthLimitTitle')}</div>
             <div style="color:#cbd5e1; font-size:13px; line-height:1.6;">
                ${t('orgDepthLimitDesc').replace('{rank}', userRank).replace('{depth}', maxDepth)}
             </div>
           </div>
        `;
     }
     return;
  }
  // -------------------------------------

  try {
    const availableDepth = Math.max(1, maxDepth - window.cavePath.length + 1);
    const fetchDepth = Math.min(3, availableDepth); // 3 depths max at once
    
    let children = [];
    const { collection, query, where, getDocs, limit, db } = window.FB;
    
    // Level 1
    const q1 = query(collection(db, 'users'), where('referredBy', '==', lastNode.id));
    const snap1 = await getDocs(q1);
    children = snap1.docs.map(d => ({ id: d.id, ...d.data(), children: [], hasMore: false }));
    
    if (fetchDepth >= 2 && children.length > 0) {
        await Promise.all(children.map(async p1 => {
            const q2 = query(collection(db, 'users'), where('referredBy', '==', p1.id));
            const s2 = await getDocs(q2);
            p1.children = s2.docs.map(d => ({ id: d.id, ...d.data(), children: [], hasMore: false }));
            
            if (fetchDepth >= 3 && p1.children.length > 0) {
                await Promise.all(p1.children.map(async p2 => {
                    const q3 = query(collection(db, 'users'), where('referredBy', '==', p2.id));
                    const s3 = await getDocs(q3);
                    p2.children = s3.docs.map(d => ({ id: d.id, ...d.data(), children: [], hasMore: false }));
                    
                    // check hasMore for level 3
                    if (p2.children.length > 0) {
                        await Promise.all(p2.children.map(async p3 => {
                            const q4 = query(collection(db, 'users'), limit(1), where('referredBy', '==', p3.id));
                            const s4 = await getDocs(q4);
                            p3.hasMore = !s4.empty;
                        }));
                    }
                }));
            } else if (p1.children.length > 0) {
                // check hasMore for level 2
                await Promise.all(p1.children.map(async p2 => {
                    const qt = query(collection(db, 'users'), limit(1), where('referredBy', '==', p2.id));
                    const st = await getDocs(qt);
                    p2.hasMore = !st.empty;
                }));
            }
        }));
    } else if (children.length > 0) {
        // check hasMore for level 1
        await Promise.all(children.map(async p1 => {
            const qt = query(collection(db, 'users'), limit(1), where('referredBy', '==', p1.id));
            const st = await getDocs(qt);
            p1.hasMore = !st.empty;
        }));
    }

    const childrenWrap = document.getElementById('caveChildrenWrap');
    if (!childrenWrap) return;

    if (children.length === 0) {
       childrenWrap.innerHTML = `<div style="color:var(--text3); font-size:13px; text-align:center; padding:20px;">
          ${lastNode.id === currentUser.uid ? t('shareToExpand') : t('noSubMembers')}
       </div>`;
    } else {
       const buildNestedHtml = (nodes, currentDepth) => {
          if (!nodes || nodes.length === 0) return '';
          let html = `<div style="display:flex; justify-content:center; align-items:flex-start; position:relative;">`;
          
          nodes.forEach((n, idx) => {
             html += `<div style="display:flex; flex-direction:column; align-items:center; position:relative; padding:0 8px;">`;
             
             if (nodes.length > 1) {
                 let left = idx === 0 ? '50%' : '0';
                 let width = (idx === 0 || idx === nodes.length - 1) ? '50%' : '100%';
                 html += `<div style="position:absolute; top:0; left:${left}; width:${width}; height:2px; background:rgba(157,78,221,0.5); z-index:0;"></div>`;
             }

             html += `<div style="width:2px; height:24px; background:rgba(157,78,221,0.5); z-index:0;"></div>`;
             
             html += `<div style="z-index:1;">`;
             html += renderNode(n, false, -1);
             html += `</div>`;

             if (n.children && n.children.length > 0 && currentDepth < fetchDepth) {
                 html += `<div style="width:2px; height:24px; background:rgba(157,78,221,0.5); margin:0; z-index:0;"></div>`;
                 html += buildNestedHtml(n.children, currentDepth + 1);
             } else if (n.hasMore || (n.children && n.children.length > 0)) {
                 const displayId = n.username || (n.email ? n.email.split('@')[0] : (n.id ? n.id.substring(0, 8).toUpperCase() : '***'));
                 html += `<div style="margin-top:12px; font-size:11px; background:rgba(157,78,221,0.2); border:1px solid rgba(157,78,221,0.4); padding:6px 12px; border-radius:12px; color:#e2e8f0; cursor:pointer; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.2); transition:all 0.2s;" onmouseover="this.style.background='rgba(157,78,221,0.4)'" onmouseout="this.style.background='rgba(157,78,221,0.2)'" onclick="showNodeActionModal('${n.id}', '${(displayId).replace(/'/g, `\\'`)}', '${n.rank}', false, -1, '${n.referralCount || n.totalReferrals || 0}')">▼ 더보기 (${n.rank||'G0'})</div>`;
             }
             
             html += `</div>`;
          });
          
          html += `</div>`;
          return html;
       };

       childrenWrap.innerHTML = buildNestedHtml(children, 1);
    }
  
  } catch (err) {
    console.error(err);
    const childrenWrap = document.getElementById('caveChildrenWrap');
    if (childrenWrap) childrenWrap.innerHTML = '<div style="color:#ef4444;font-size:13px;">데이터를 불러오지 못했습니다. (' + err.message + ')</div>';
  }
  
  // 새로 렌더링된 요소가 적절한 위치에 오도록 스크롤 (화면 약간 위쪽으로 포커스)
  
  setTimeout(() => {
    const scroller = document.getElementById('orgChartWrap');
    if (!scroller) return;

    // Focus on the children wrap so the active node and children are visible
    const childrenWrap = document.getElementById('caveChildrenWrap');
    if (childrenWrap) {
        const wrapRect = childrenWrap.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const relativeTop = (wrapRect.top - scrollerRect.top) + scroller.scrollTop;
        
        // 포커스를 childrenWrap의 약간 위쪽(활성 노드 위치)에 맞춤
        const targetScroll = relativeTop - (scroller.clientHeight / 2) + 50;
        
        scroller.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }, 150);

};
window.showNodeActionModal = function(id, name, rank, isPathNode, pathIndex, refCount = 0) {
   if (id === currentUser.uid) {
      // 본인이면 그냥 탐색만 (최상단이면 아무것도 안함)
      if (isPathNode && pathIndex === window.cavePath.length - 1) return;
      window.handleCaveNodeClick(id, name, rank, isPathNode, pathIndex, refCount);
      return;
   }

   const modalHtml = `
      <div id="nodeActionModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center; animation: fadeIn 0.2s;">
         <div style="background:var(--bg-card); padding:24px; border-radius:16px; width:300px; text-align:center; border:1px solid rgba(255,255,255,0.1); animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <div style="width:50px; height:50px; border-radius:50%; background:rgba(255,255,255,0.1); overflow:hidden; margin:0 auto 12px;">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${name}&backgroundColor=transparent" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <h3 style="margin-top:0; margin-bottom:16px; color:#fff;">${name} <span style="font-size:12px; font-weight:normal; background:var(--primary); padding:2px 6px; border-radius:8px;">${rank}</span></h3>
            
            <button onclick="window.doNodeAction('chat', '${id}', '${(name||``).replace(/'/g, `\\'`)}')" style="width:100%; padding:14px; border-radius:10px; border:none; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:#fff; font-weight:bold; margin-bottom:10px; cursor:pointer; font-size:15px; display:flex; justify-content:center; align-items:center; gap:8px;">
                <i class="fas fa-comment-dots"></i> 1:1 채팅하기
            </button>
            <button onclick="window.doNodeAction('nav', '${id}', '${(name||``).replace(/'/g, `\\'`)}', '${rank}', ${isPathNode}, ${pathIndex}, '${refCount}')" style="width:100%; padding:14px; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:#fff; font-weight:bold; margin-bottom:12px; cursor:pointer; font-size:15px; display:flex; justify-content:center; align-items:center; gap:8px;">
                <i class="fas fa-sitemap"></i> ${isPathNode ? '이곳으로 이동' : '상세보기 (하위 조직)'}
            </button>
            
            <button onclick="document.getElementById('nodeActionModal').remove()" style="width:100%; padding:12px; border-radius:10px; border:none; background:transparent; color:var(--text-sec); cursor:pointer; font-size:14px;">
                닫기
            </button>
         </div>
      </div>
   `;
   document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.doNodeAction = function(action, id, name, rank, isPathNode, pathIndex, refCount = 0) {
   const modal = document.getElementById('nodeActionModal');
   if (modal) modal.remove();
   
   if (action === 'chat') {
       window.switchPage('chat');
       if (window.chatManager && window.chatManager.openDirectChat) {
           window.chatManager.openDirectChat(id, name);
       }
   } else if (action === 'nav') {
       window.handleCaveNodeClick(id, name, rank, isPathNode, pathIndex, refCount);
   }
};

window.handleCaveNodeClick = function(id, name, rank, isPathNode, pathIndex, refCount = 0) {
