/**
 * public/js/bot.js
 * Bot Flows page: list flows, create/edit, toggle active, delete.
 */

const BotPage = (() => {
  let editingId = null;

  async function load() {
    const tbody = document.getElementById('bot-flows-tbody');
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row"><div class="spinner"></div></td></tr>`;
    try {
      const { flows } = await API.flows();
      if (!flows.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5">
              <div class="empty-state">
                <div class="empty-graphic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7M9 7h6M9 3h6v4H9z"/></svg></div>
                <h3>No bot flows yet</h3>
                <p>Automate your customer interactions by creating keyword-based auto-replies.</p>
                <button class="btn btn-primary" onclick="BotPage.openCreate()">Create Your First Flow</button>
              </div>
            </td>
          </tr>
        `;
        return;
      }
      tbody.innerHTML = flows.map(f => {
        const c = f.response_content || {};
        const preview = c.message || (f.response_type === 'handoff' ? 'Transfer to human' : 'Interactive content');
        
        return `
          <tr>
            <td><code class="badge badge-indigo" style="font-family:'Geist Mono',monospace;">${esc(f.trigger_keyword)}</code></td>
            <td><span class="badge badge-indigo">${esc(f.response_type)}</span></td>
            <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);" title="${esc(preview)}">${esc(preview)}</td>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" ${f.active ? 'checked' : ''} onchange="BotPage.toggle(${f.id})" style="width:16px;height:16px;cursor:pointer;">
                <span style="font-size:12px;color:var(--text-muted)">${f.active ? 'Active' : 'Paused'}</span>
              </div>
            </td>
            <td>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-icon btn-sm" onclick="BotPage.edit(${f.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="btn btn-secondary btn-icon btn-sm" style="color:var(--error)" onclick="BotPage.remove(${f.id},'${esc(f.trigger_keyword)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
              </div>
            </td>
          </tr>`;
      }).join('');
    } catch (err) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Failed to load flows</div></td></tr>'; }
  }

  function openCreate() {
    editingId = null;
    const body = `
      <form id="flow-form" style="display:flex; flex-direction:column; gap:16px;">
        <div><label class="stat-label">Trigger Keyword</label><input type="text" name="trigger_keyword" required></div>
        <div>
          <label class="stat-label">Response Type</label>
          <select name="response_type" id="f-type">
            <option value="text">Text Message</option>
            <option value="handoff">Agent Handoff</option>
          </select>
        </div>
        <div><label class="stat-label">Response Message</label><textarea name="message" rows="3" required></textarea></div>
      </form>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-flow-btn">Create Flow</button>
    `;
    openModal('New Bot Flow', body, footer);
    document.getElementById('save-flow-btn').onclick = save;
  }

  async function save() {
    const data = getFormData('flow-form');
    const payload = {
      trigger_keyword: data.trigger_keyword,
      response_type: data.response_type,
      response_content: { message: data.message },
      active: true
    };
    try {
      await API.createFlow(payload);
      toast('Flow created');
      closeModal();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function toggle(id) {
    try { 
      await API.toggleFlow(id); 
      toast('Flow toggled');
    } catch (err) { toast(err.message, 'error'); load(); }
  }

  async function remove(id, keyword) {
    if (!confirm(`Delete flow for "${keyword}"?`)) return;
    try { await API.deleteFlow(id); toast('Deleted'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  function init() {
    document.getElementById('new-flow-btn').onclick = openCreate;
    load();
  }

  return { init, load, openCreate, toggle, remove };
})();
