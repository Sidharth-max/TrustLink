/**
 * public/js/agents.js
 * Agents management page: team members, role badges, and status.
 * Redesigned for Premium Indigo/Slate.
 */

const AgentsPage = (() => {
  let agents = [];

  async function load() {
    const tbody = document.getElementById('agents-tbody');
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading-row"><div class="spinner"></div></div></td></tr>';

    try {
      const data = await API.agents();
      agents = data.agents || [];

      if (agents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">No agents found</div></td></tr>';
        return;
      }

      tbody.innerHTML = agents.map(a => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="logo-box" style="width:32px; height:32px; background:var(--surface-3); font-size:12px;">${initials(a.name)}</div>
              <div>
                <div style="font-weight:600;">${esc(a.name)}</div>
                <div style="font-size:11px; color:var(--text-muted)">ID: ${a.id}</div>
              </div>
            </div>
          </td>
          <td><span style="color:var(--text-secondary)">${esc(a.email)}</span></td>
          <td>${statusBadge(a.role)}</td>
          <td><span style="font-size:13px; color:var(--text-muted)">${fmtDate(a.created_at)}</span></td>
          <td>
             <div style="display:flex; gap:8px;">
               <button class="btn btn-secondary btn-icon btn-sm" onclick="AgentsPage.edit(${a.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
               <button class="btn btn-secondary btn-icon btn-sm" style="color:var(--error)" onclick="AgentsPage.delete(${a.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
             </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Access required to view agents</div></td></tr>';
    }
  }

  function openAdd() {
    const body = `
      <form id="agent-form" style="display:flex; flex-direction:column; gap:16px;">
        <div><label class="stat-label">Full Name</label><input type="text" name="name" required></div>
        <div><label class="stat-label">Email</label><input type="email" name="email" required></div>
        <div><label class="stat-label">Password</label><input type="password" name="password" required></div>
        <div>
          <label class="stat-label">Role</label>
          <select name="role">
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </form>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-agent-btn">Add Agent</button>
    `;
    openModal('New Team Member', body, footer);
    document.getElementById('save-agent-btn').onclick = save;
  }

  async function save() {
    const data = getFormData('agent-form');
    try {
      await API.createAgent(data);
      toast('Agent added');
      closeModal();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteAgent(id) {
    if (!confirm('Are you sure?')) return;
    try {
      await API.deleteAgent(id);
      toast('Agent deleted');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  function init() {
    document.getElementById('new-agent-btn').onclick = openAdd;
    load();
  }

  return { init, load, openAdd, delete: deleteAgent };
})();
