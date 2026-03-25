/**
 * public/js/agents.js
 * Agents management page (admin only).
 */

const AgentsPage = (() => {
  let editingId = null;

  async function load() {
    const tbody = document.getElementById('agents-tbody');
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row"><div class="spinner"></div></td></tr>`;
    try {
      const { agents } = await API.agents();
      if (!agents.length) { tbody.innerHTML = emptyRow(5); return; }
      tbody.innerHTML = agents.map(a => `
        <tr>
          <td data-label="Name">
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="agent-avatar" style="width:32px;height:32px;font-size:.8rem;">${initials(a.name)}</div>
              <strong>${esc(a.name)}</strong>
            </div>
          </td>
          <td data-label="Email">${esc(a.email)}</td>
          <td data-label="Role">${statusBadge(a.role)}</td>
          <td data-label="Joined">${fmtDate(a.created_at)}</td>
          <td data-label="Actions">
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="AgentsPage.edit(${a.id})">✏️</button>
              <button class="btn btn-ghost btn-sm" onclick="AgentsPage.remove(${a.id},'${esc(a.name)}')">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      if (err.message.includes('403') || err.message.includes('Forbidden')) {
        tbody.innerHTML = emptyRow(5, 'Admin access required to view agents');
      } else {
        tbody.innerHTML = emptyRow(5, 'Failed to load');
      }
    }
  }

  function openCreate() {
    editingId = null;
    document.getElementById('agent-modal-title').textContent = 'Add Agent';
    document.getElementById('a-id').value       = '';
    document.getElementById('a-name').value     = '';
    document.getElementById('a-email').value    = '';
    document.getElementById('a-password').value = '';
    document.getElementById('a-role').value     = 'agent';
    document.getElementById('a-pwd-label').textContent = 'Password *';
    openModal('agent-modal');
  }

  async function edit(id) {
    editingId = id;
    try {
      const { agents } = await API.agents();
      const a = agents.find(x => x.id === id);
      if (!a) return;
      document.getElementById('agent-modal-title').textContent = 'Edit Agent';
      document.getElementById('a-id').value    = a.id;
      document.getElementById('a-name').value  = a.name;
      document.getElementById('a-email').value = a.email;
      document.getElementById('a-password').value = '';
      document.getElementById('a-role').value  = a.role;
      document.getElementById('a-pwd-label').textContent = 'New Password (leave blank to keep)';
      openModal('agent-modal');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function save() {
    const id = document.getElementById('a-id').value;
    const payload = {
      name:     document.getElementById('a-name').value.trim(),
      email:    document.getElementById('a-email').value.trim(),
      role:     document.getElementById('a-role').value,
    };
    const pwd = document.getElementById('a-password').value;
    if (pwd) payload.password = pwd;

    if (!payload.name || !payload.email) { toast('Name and email required', 'error'); return; }
    if (!id && !pwd) { toast('Password required for new agent', 'error'); return; }

    try {
      if (id) { await API.updateAgent(id, payload); toast('Agent updated'); }
      else    { await API.createAgent(payload);      toast('Agent created'); }
      closeModal('agent-modal');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id, name) {
    if (!confirm(`Delete agent "${name}"?`)) return;
    try { await API.deleteAgent(id); toast('Agent deleted'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  function init() {
    document.getElementById('new-agent-btn').addEventListener('click', openCreate);
    document.getElementById('save-agent-btn').addEventListener('click', save);
    load();
  }

  return { init, load, edit, remove };
})();
