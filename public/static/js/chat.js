// chat.js - Firebase Chat logic
window.chatManager = {
  currentRoom: 'group', // 'group' or 'upline' or 'direct'
  directRoomId: null,
  unsubscribe: null,
  sponsorId: null,

  init() {
    // window.currentUser or userData
    const user = window.currentUser || window.userData;
    if (!user) return;
    
    // userData has referredBy
    if (window.userData && window.userData.referredBy) {
      this.sponsorId = window.userData.referredBy;
    }
    
    this.loadMessages();
  },

  switchChatRoom(room) {
    this.currentRoom = room;
    
    // Show tabs if group or upline
    const tabsWrap = document.getElementById('chatTabsWrap');
    if (tabsWrap) tabsWrap.style.display = 'flex';

    // Reset title
    const titleEl = document.getElementById('chatTitle');
    if (titleEl) titleEl.innerHTML = window.t ? window.t('pageChat') : '💬 채팅';

    // Update Tab UI
    const btnGroup = document.getElementById('tabChatGroup');
    const btnUpline = document.getElementById('tabChatUpline');
    
    if (room === 'group') {
      btnGroup.style.background = 'var(--primary)';
      btnGroup.style.color = '#fff';
      btnGroup.style.border = 'none';
      
      btnUpline.style.background = 'var(--surface)';
      btnUpline.style.color = 'var(--text-sec)';
      btnUpline.style.border = '1px solid var(--border)';
    } else {
      btnUpline.style.background = 'var(--primary)';
      btnUpline.style.color = '#fff';
      btnUpline.style.border = 'none';
      
      btnGroup.style.background = 'var(--surface)';
      btnGroup.style.color = 'var(--text-sec)';
      btnGroup.style.border = '1px solid var(--border)';
    }

    this.loadMessages();
  },

  openDirectChat(targetUid, targetName) {
    const user = window.currentUser || window.userData;
    const myUid = user ? (user.uid || user.id) : null;
    if (!myUid) return;

    // Sort alphabetically to create a unique room ID for the pair
    const uids = [myUid, targetUid].sort();
    this.directRoomId = `direct_${uids[0]}_${uids[1]}`;
    this.currentRoom = 'direct';

    // Hide tabs, change title
    const tabsWrap = document.getElementById('chatTabsWrap');
    if (tabsWrap) tabsWrap.style.display = 'none';

    const titleEl = document.getElementById('chatTitle');
    if (titleEl) titleEl.innerHTML = `💬 ${targetName} 님과의 1:1 채팅`;

    this.loadMessages();

    // Clear unread flag for this room
    if (myUid) {
      try {
        const { doc, setDoc, db } = window.FB;
        setDoc(doc(db, 'chats', this.directRoomId), {
          [`unread_${myUid}`]: false
        }, { merge: true }).catch(()=>{});
      } catch(e) {}
    }
  },

  getRoomId() {
    if (this.currentRoom === 'direct') {
      return this.directRoomId;
    }
    const user = window.currentUser || window.userData;
    const uid = user ? (user.uid || user.id) : null;
    
    if (this.currentRoom === 'group') {
      if (!uid) return null;
      return `group_${uid}`;
    } else {
      if (!this.sponsorId) return null;
      return `group_${this.sponsorId}`;
    }
  },

  async loadMessages() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    const roomId = this.getRoomId();
    const chatBox = document.getElementById('chatMessages');
    
    if (!roomId) {
      chatBox.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-sec);">스폰서가 없습니다.</div>`;
      return;
    }

    chatBox.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-sec);">로딩 중...</div>`;

    const { collection, query, orderBy, limit, onSnapshot, db } = window.FB;
    
    const q = query(
      collection(db, 'chats', roomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      chatBox.innerHTML = '';
      
      if (snapshot.empty) {
        chatBox.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-sec);">첫 메시지를 보내보세요!</div>`;
        return;
      }

      snapshot.forEach(doc => {
        const msg = doc.data();
        const user = window.currentUser || window.userData;
        const uid = user ? (user.uid || user.id) : null;
        const isMe = msg.senderId === uid;
        
        // Date formatting
        let timeStr = '';
        if (msg.createdAt) {
          const d = msg.createdAt.toDate();
          timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
        
        const html = `
          <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; width:100%;">
            ${!isMe ? `<div style="font-size:12px; color:var(--text-sec); margin-bottom:4px; margin-left:4px;">${msg.senderName || '사용자'}</div>` : ''}
            <div style="display:flex; align-items:flex-end; gap:6px; flex-direction:${isMe ? 'row' : 'row-reverse'};">
              ${isMe ? `<span style="font-size:10px; color:var(--text-sec);">${timeStr}</span>` : ''}
              <div style="max-width:240px; padding:12px 16px; border-radius:16px; font-size:14px; line-height:1.4; word-break:break-word;
                ${isMe 
                  ? 'background:var(--primary); color:#fff; border-bottom-right-radius:4px;' 
                  : 'background:var(--surface); color:var(--text); border:1px solid var(--border); border-bottom-left-radius:4px;'}">
                ${this.escapeHtml(msg.text)}
              </div>
              ${!isMe ? `<span style="font-size:10px; color:var(--text-sec);">${timeStr}</span>` : ''}
            </div>
          </div>
        `;
        chatBox.insertAdjacentHTML('beforeend', html);
      });
      
      // Scroll to bottom
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  },

  async sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    const roomId = this.getRoomId();
    if (!roomId) {
      window.showToast('스폰서가 없어 보낼 수 없습니다.', 'warning');
      return;
    }

    input.value = '';
    input.style.height = '45px'; // reset height

    try {
      const { collection, addDoc, serverTimestamp, doc, setDoc, db } = window.FB;
      const user = window.currentUser || window.userData;
      const uid = user ? (user.uid || user.id) : null;
      let userName = '사용자';
      if (window.userData && window.userData.name) userName = window.userData.name;
      else if (user && user.email) userName = user.email.split('@')[0];
      
      await addDoc(collection(db, 'chats', roomId, 'messages'), {
        senderId: uid,
        senderName: userName,
        text: text,
        createdAt: serverTimestamp()
      });

      // Update room metadata for unread badges in direct chat
      if (this.currentRoom === 'direct') {
        const parts = this.directRoomId.replace('direct_', '').split('_');
        const targetUid = parts[0] === uid ? parts[1] : parts[0];
        
        await setDoc(doc(db, 'chats', roomId), {
          participants: [uid, targetUid],
          updatedAt: serverTimestamp(),
          [`unread_${targetUid}`]: true
        }, { merge: true }).catch(e => console.error(e));
      }

    } catch (err) {
      console.error(err);
      window.showToast('메시지 전송 실패', 'error');
    }
  },

  escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
};

// 1:1 채팅 알림 리스너 (앱 초기화 시 호출)
window.unreadChatSenders = new Set();
window.unreadChatPaths = new Set();
const chatReferredByCache = {};

window.startChatNotificationListener = function() {
  const user = window.currentUser || window.userData;
  const myUid = user ? (user.uid || user.id) : null;
  if (!myUid) return;

  const { collection, query, where, onSnapshot, doc, getDoc, db } = window.FB;
  const q = query(collection(db, 'chats'), where('participants', 'array-contains', myUid));

  onSnapshot(q, async (snap) => {
    window.unreadChatSenders.clear();

    for (const d of snap.docs) {
      const data = d.data();
      if (data[`unread_${myUid}`]) {
        const otherUid = data.participants.find(p => p !== myUid);
        if (otherUid) window.unreadChatSenders.add(otherUid);
      }
    }

    // 네비게이션/버튼에 뱃지 표시 로직
    updateChatBadgeUI();

    // 조직도 뱃지를 위한 path 계산 (역산)
    window.unreadChatPaths.clear();
    for (const senderId of window.unreadChatSenders) {
      let curId = senderId;
      // myUid가 나올때까지 조상을 추적
      while (curId && curId !== myUid) {
        window.unreadChatPaths.add(curId);
        
        // 캐시 확인
        if (chatReferredByCache[curId] !== undefined) {
          curId = chatReferredByCache[curId];
        } else {
          try {
            const docSnap = await getDoc(doc(db, 'users', curId));
            if (docSnap.exists()) {
              const refId = docSnap.data().referredBy || null;
              chatReferredByCache[curId] = refId;
              curId = refId;
            } else {
              chatReferredByCache[curId] = null;
              curId = null;
            }
          } catch(e) {
            curId = null;
          }
        }
      }
    }

    // 조직도가 열려있다면 다시 렌더링해서 뱃지 띄우기
    if (document.getElementById('orgTree') && window.renderCaveTree) {
       window.renderCaveTree();
    }
  });
};

function updateChatBadgeUI() {
  const btn = document.querySelector('button[onclick*="switchPage(\\'chat\\')"]');
  if (!btn) return;
  
  let badge = btn.querySelector('.chat-unread-badge');
  if (window.unreadChatSenders.size > 0) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'chat-unread-badge';
      badge.style.cssText = 'position:absolute; top:-4px; right:-4px; width:12px; height:12px; background:#ef4444; border-radius:50%; border:2px solid var(--surface); animation: pulse 2s infinite; z-index: 10;';
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  } else {
    if (badge) badge.remove();
  }
}
