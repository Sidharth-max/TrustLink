/**
 * public/js/inbox.js
 * Inbox page: conversation list + real-time-ish chat view.
 * Mobile: conversation list and chat panel are full-screen stacked.
 * Desktop: split-panel layout.
 */

const InboxPage = (() => {
  let activeConvId   = null;
  let allAgents      = [];
  let pollTimer      = null;

  // ── Load conversation list ────────────────────────────────────────
  async function loadList(status = null) {
    const realStatus = status || document.getElementById('conv-status-filter').value || 'open';
    const scroll = document.getElementById('conv-list-scroll');
    scroll.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

    try {
      const { conversations } = await API.conversations({ status: realStatus, limit: 60 });
      if (conversations.length === 0) {
        scroll.innerHTML = '<div class="empty-state"><p>No conversations</p></div>';
        // Update inbox badge
        document.getElementById('inbox-badge').style.display = 'none';
        return;
      }

      // Count total unread for sidebar badge
      const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      const badge = document.getElementById('inbox-badge');
      if (totalUnread > 0) { badge.style.display = ''; badge.textContent = totalUnread > 99 ? '99+' : totalUnread; }
      else { badge.style.display = 'none'; }

      scroll.innerHTML = conversations.map(c => {
        const name  = c.contact_name || c.contact_phone;
        const ini   = initials(c.contact_name, c.contact_phone?.[0] || '?');
        const ago   = relativeTime(c.last_message_at);
        const preview = c.last_message ? esc(c.last_message.slice(0, 60)) : 'No messages yet';
        return `
          <div class="conv-item${c.id === activeConvId ? ' active' : ''}"
               data-id="${c.id}" onclick="InboxPage.openConv(${c.id})">
            <div class="conv-avatar">${ini}</div>
            <div class="conv-meta">
                <div style="display:flex;align-items:center;gap:6px;">
                  <div class="conv-name">${esc(name)}</div>
                  ${c.bot_active ? '<span class="bot-badge active">Bot</span>' : '<span class="bot-badge">Human</span>'}
                </div>
                <div class="conv-preview">${preview}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <div class="conv-time">${ago}</div>
                ${c.unread_count > 0 ? `<div class="conv-unread">${c.unread_count}</div>` : ''}
              </div>
            </div>`;
      }).join('');
    } catch (err) {
      scroll.innerHTML = '<div class="empty-state"><p>Failed to load</p></div>';
      console.error(err);
    }
  }

  // ── Open a conversation ───────────────────────────────────────────
  async function openConv(id) {
    activeConvId = id;

    // On mobile: slide chat panel in, hide list
    document.getElementById('conv-list-panel').classList.add('hidden');
    const chatPanel = document.getElementById('chat-panel');
    chatPanel.classList.add('open');

    // Hide empty state, show chat view
    document.getElementById('chat-empty').style.display    = 'none';
    const chatView = document.getElementById('chat-view');
    chatView.style.display = 'flex';

    // Re-mark active in list
    document.querySelectorAll('.conv-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.id, 10) === id);
    });

    await loadConv(id);
    startPolling(id);
  }

  async function loadConv(id) {
    document.getElementById('chat-messages').innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

    try {
      const { conversation, messages } = await API.conversation(id);

      // Header
      document.getElementById('chat-name').textContent  = conversation.contact_name || conversation.contact_phone;
      document.getElementById('chat-phone').textContent = conversation.contact_phone;
      document.getElementById('chat-avatar').textContent = initials(conversation.contact_name, conversation.contact_phone?.[0] || '?');

      // Status + assignment + bot toggle
      document.getElementById('chat-status-sel').value = conversation.status;
      document.getElementById('bot-toggle-chk').checked = conversation.bot_active;

      // Populate agent dropdown
      const assignSel = document.getElementById('chat-assign-sel');
      assignSel.innerHTML = '<option value="">Unassigned</option>';
      allAgents.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id; opt.textContent = a.name;
        if (a.id === conversation.assigned_to) opt.selected = true;
        assignSel.appendChild(opt);
      });

      renderMessages(messages);
    } catch (err) { console.error('loadConv error:', err); }
  }

  function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (messages.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
      return;
    }
    container.innerHTML = messages.map(m => {
      const out   = m.direction === 'outbound';
      const time  = fmtTime(m.sent_at || m.created_at);
      const statusIcon = out ? (m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : '✓') : '';
      
      let contentHtml = esc(m.content || '');
      if (['image', 'video'].includes(m.type) && m.content) {
          contentHtml = `<img src="${m.content}" class="msg-media" loading="lazy" onclick="window.open('${m.content}')" onerror="this.src='/img/file-broken.png'"/>`;
      } else if (m.type === 'audio' && m.content) {
          contentHtml = `<audio controls class="msg-media"><source src="${m.content}" type="audio/mpeg"></audio>`;
      }
      
      return `
        <div class="msg-bubble ${out ? 'out' : 'in'}">
          ${contentHtml}
          <div class="msg-time">${time} ${statusIcon ? `<span style="color:${m.status==='read'?'#53bdeb':'inherit'}">${statusIcon}</span>` : ''}</div>
        </div>`;
    }).join('');
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  // ── Send a reply ──────────────────────────────────────────────────
  async function sendReply() {
    if (!activeConvId) return;
    const input = document.getElementById('chat-reply-input');
    const text  = input.value.trim();
    if (!text) return;

    // Get contact_id from conversation
    try {
      const { conversation } = await API.conversation(activeConvId);
      await API.sendMessage({ contact_id: conversation.contact_id, type: 'text', content: text });
      input.value = '';
      await loadConv(activeConvId);
      toast('Message sent');
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Update conversation settings ──────────────────────────────────
  async function updateConv() {
    if (!activeConvId) return;
    const payload = {
      status:      document.getElementById('chat-status-sel').value,
      assigned_to: document.getElementById('chat-assign-sel').value || null,
      bot_active:  document.getElementById('bot-toggle-chk').checked,
    };
    try {
      await API.updateConversation(activeConvId, payload);
      toast('Conversation updated');
      loadList();
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Poll for new messages every 10 seconds ─────────────────────────
  function startPolling(convId) {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (activeConvId === convId) await loadConv(convId);
    }, 10000);
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  // ── Back button (mobile) ──────────────────────────────────────────
  function goBack() {
    stopPolling();
    activeConvId = null;
    document.getElementById('conv-list-panel').classList.remove('hidden');
    document.getElementById('chat-panel').classList.remove('open');
    document.getElementById('chat-empty').style.display = '';
    document.getElementById('chat-view').style.display  = 'none';
  }

  function init() {
    // Pre-load agents list for assignment dropdown
    API.agents().then(d => { allAgents = d.agents || []; }).catch(() => {});

    document.getElementById('conv-status-filter').addEventListener('change', () => loadList());
    document.getElementById('conv-search').addEventListener('input', () => loadList());
    document.getElementById('chat-back-btn').addEventListener('click', goBack);
    document.getElementById('chat-send-btn').addEventListener('click', sendReply);
    document.getElementById('chat-reply-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
    });
    // Update conversation when status/assignment changes
    document.getElementById('chat-status-sel').addEventListener('change', updateConv);
    document.getElementById('chat-assign-sel').addEventListener('change', updateConv);
    document.getElementById('bot-toggle-chk').addEventListener('change', updateConv);

    loadList();
  }

  return { init, load: loadList, openConv };
})();
