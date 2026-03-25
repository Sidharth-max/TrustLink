/**
 * public/js/inbox.js
 * Inbox page: conversation list + real-time-ish chat view.
 * Redesigned for WhatsApp Web (Chat-First UX).
 */

const InboxPage = (() => {
  let activeConvId   = null;
  let pollTimer      = null;
  let currentFilter  = 'all';

  async function loadList(filter = null) {
    if (filter) currentFilter = filter;
    
    const list = document.getElementById('conv-list-scroll');
    showSkeletons('conv-list-scroll', 6);

    try {
      const { conversations } = await API.conversations({ status: 'open', limit: 100 });
      
      // WhatsApp Sort: latest message at top
      let filtered = conversations.sort((a, b) => {
        return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
      });

      if (currentFilter === 'unread') {
        filtered = filtered.filter(c => (c.unread_count || 0) > 0);
      } else if (currentFilter === 'assigned') {
        // assigned filter logic if needed
      }

      if (filtered.length === 0) {
        list.innerHTML = `
          <div style="padding:40px 20px; text-align:center;">
            <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">No conversations found</p>
            <button class="btn btn-secondary btn-sm" onclick="InboxPage.load('all')">View All</button>
          </div>
        `;
        return;
      }

      list.innerHTML = filtered.map(c => {
        const name  = c.contact_name || c.contact_phone;
        const ini   = initials(name);
        const ago   = relativeTime(c.last_message_at);
        
        // WhatsApp Preview Rules
        let preview = 'No messages yet';
        if (c.last_message) {
          const prefix = c.last_message_direction === 'outbound' ? 'You: ' : '';
          preview = `${prefix}${esc(c.last_message)}`;
        }
        
        return `
          <div class="conv-item ${c.id === activeConvId ? 'active' : ''}" onclick="InboxPage.openConv(${c.id})">
            <div class="logo-box" style="width:48px; height:48px; background:var(--surface-3); font-size:16px; flex-shrink:0;">${ini}</div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <div style="font-weight:600; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(name)}</div>
                <div style="font-size:11px; color:var(--text-muted)">${ago}</div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div class="msg-preview">${preview}</div>
                ${c.unread_count > 0 ? `<span class="nav-badge" style="background:var(--success); min-width:18px; text-align:center;">${c.unread_count}</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      list.innerHTML = '<div class="empty-state" style="padding:20px;"><p>Failed to load</p></div>';
    }
  }

  async function openConv(id) {
    activeConvId = id;
    
    // UI state & Mobile Toggle
    document.getElementById('page-inbox').classList.add('show-chat');
    document.getElementById('chat-empty').style.display    = 'none';
    document.getElementById('chat-view').style.display     = 'flex';
    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
    
    // Focus input
    setTimeout(() => document.getElementById('chat-reply-input').focus(), 100);

    try {
      const { conversation, messages } = await API.conversation(id);
      
      // Header
      const name = conversation.contact_name || conversation.contact_phone;
      document.getElementById('chat-avatar').textContent = initials(name);
      document.getElementById('chat-name').textContent   = name;
      document.getElementById('chat-status').textContent = conversation.status === 'open' ? 'online' : conversation.status;
      document.getElementById('chat-status').style.color = conversation.status === 'open' ? 'var(--success)' : 'var(--text-muted)';

      // Status dropdown
      const statuses = ['open', 'pending', 'resolved', 'closed'];
      const sel = document.getElementById('chat-status-sel');
      sel.innerHTML = statuses.map(s => `<option value="${s}" ${conversation.status === s ? 'selected' : ''}>${s.toUpperCase()}</option>`).join('');
      sel.onchange = () => updateStatus(id, sel.value);

      renderMessages(messages);
      startPolling(id);
    } catch (err) {
      toast('Failed to load chat', 'error');
    }
  }

  function renderMessages(messages) {
    const list = document.getElementById('chat-messages');
    if (messages.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:40px;"><p>No messages yet.</p></div>';
      return;
    }


    list.innerHTML = messages.map(m => {
      const isOut = m.direction === 'outbound';
      const time  = fmtTime(m.created_at || new Date()); // Fallback if no date
      const status = m.status || 'sent';

      let statusIcon = '';
      if (isOut) {
        if (status === 'read') statusIcon = '✓✓'; // Blue checks ideally
        else if (status === 'delivered') statusIcon = '✓✓';
        else statusIcon = '✓';
      }
      
      let content = esc(m.content || '');
      if (m.type === 'image' && m.content) {
        content = `<img src="${m.content}" style="max-width:100%; border-radius:8px; margin-bottom:4px; cursor:pointer;" onclick="window.open('${m.content}')" alt="Image">`;
      }
      
      // Bubble classes
      const bubbleClass = isOut ? 'bubble-out' : 'bubble-in';
      
      // Timestamp & status color
      // In dark mode: white with opacity. In light mode: standard text with opacity.
      // We use currentColor with opacity for maximum compatibility.
      const metaColor = 'opacity: 0.7; font-size: 11px;';
      const checkColor = status === 'read' ? '#53bdeb' : 'currentColor'; // WhatsApp blue for read

      return `
        <div class="msg-bubble ${bubbleClass}">
          <div style="word-wrap:break-word;">${content}</div>
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:2px; ${metaColor}">
            <span>${time}</span>
            ${isOut ? `<span style="font-weight:bold; color:${checkColor};">${statusIcon}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    // Scroll to bottom
    setTimeout(() => {
      const scroll = document.getElementById('chat-messages');
      if(scroll) scroll.scrollTop = scroll.scrollHeight;
    }, 50);
  }

  async function sendMessage() {
    if (!activeConvId) return;
    const input = document.getElementById('chat-reply-input');
    const text  = input.value.trim();
    if (!text) return;

    try {
      const { conversation } = await API.conversation(activeConvId);
      await API.sendMessage({
        contact_id: conversation.contact_id,
        type: 'text',
        content: text
      });
      input.value = '';
      await openConv(activeConvId);
      loadList(); // Refresh list to move active chat to top
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function updateStatus(id, status) {
    try {
      await API.updateConversation(id, { status });
      toast(`Status: ${status}`);
      document.getElementById('chat-status').textContent = status;
    } catch (err) { toast(err.message, 'error'); }
  }

  function startPolling(id) {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (activeConvId === id) {
        const { messages } = await API.conversation(activeConvId);
        // Only re-render if count changed to avoid scroll jump
        const currentCount = document.getElementById('chat-messages').children.length;
        if (messages.length !== currentCount) {
          renderMessages(messages);
          loadList();
        }
      }
    }, 10000);
  }

  function init() {
    document.getElementById('chat-reply-input').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };
    document.getElementById('chat-send-btn').onclick = sendMessage;
    
    // Mobile Back Button
    document.getElementById('chat-back-btn').onclick = () => {
      document.getElementById('page-inbox').classList.remove('show-chat');
    };

    document.getElementById('conv-search').oninput = (e) => loadList();

    initTabs('.inbox-tabs', (filter) => {
      loadList(filter);
    });

    renderEmptyState('chat-empty', {
      title: 'No chat selected',
      text: 'Start by messaging a contact or creating a new broadcast.',
      cta1: { label: 'Add Contact', onclick: () => app.showPage('contacts') },
      cta2: { label: 'New Broadcast', onclick: () => app.showPage('broadcasts') }
    });

    loadList();
  }

  return { init, load: loadList, openConv };
})();
