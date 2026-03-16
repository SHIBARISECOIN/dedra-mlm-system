// chat.js - Firebase Chat logic
window.chatManager = {
  currentRoom: 'group', // 'group' or 'upline'
  unsubscribe: null,
  sponsorId: null,

  init() {
    if (!window.currentUser) return;
    this.sponsorId = window.currentUser.referredBy;
    this.loadMessages();
  },

  switchChatRoom(room) {
    this.currentRoom = room;
    
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

  getRoomId() {
    if (this.currentRoom === 'group') {
      // Group Chat Room ID (My UID is the room ID, my direct downlines connect here)
      // Note: If I am a downline, my group chat is my upline's group chat
      // To simplify, let's make it so everyone sees the chat room of their immediate sponsor
      // Or: everyone has their own room where they are the sponsor.
      // Let's go with: "Group Chat" = Chat room owned by ME (my downlines talk here)
      // "Sponsor Chat" = Chat room owned by MY SPONSOR (I talk with my sponsor and siblings)
      
      return `group_${window.currentUser.uid}`;
    } else {
      // Upline chat room ID
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
        const isMe = msg.senderId === window.currentUser.uid;
        
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
      const { collection, addDoc, serverTimestamp, db } = window.FB;
      
      await addDoc(collection(db, 'chats', roomId, 'messages'), {
        senderId: window.currentUser.uid,
        senderName: window.currentUser.name || window.currentUser.email.split('@')[0],
        text: text,
        createdAt: serverTimestamp()
      });
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
