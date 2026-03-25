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
      if (!flows.length) { tbody.innerHTML = emptyRow(5, 'No flows yet'); return; }
      tbody.innerHTML = flows.map(f => {
        const preview = previewContent(f.response_type, f.response_content);
        return `<tr>
          <td data-label="Keyword"><code>${esc(f.trigger_keyword)}</code></td>
          <td data-label="Type"><span class="badge badge-blue">${esc(f.response_type)}</span></td>
          <td data-label="Response" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(preview)}">${esc(preview)}</td>
          <td data-label="Active">
            <label class="toggle"><input type="checkbox" ${f.active ? 'checked' : ''} onchange="BotPage.toggle(${f.id})"><span class="toggle-slider"></span></label>
          </td>
          <td data-label="Actions">
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="BotPage.edit(${f.id})">✏️</button>
              <button class="btn btn-ghost btn-sm" onclick="BotPage.remove(${f.id},'${esc(f.trigger_keyword)}')">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    } catch (err) { tbody.innerHTML = emptyRow(5, 'Failed to load'); }
  }

  function previewContent(type, content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (type === 'text' || type === 'handoff') return content.message || '';
    if (type === 'buttons') return (content.message || '') + ' [buttons]';
    if (type === 'list')    return (content.message || '') + ' [list]';
    return JSON.stringify(content).slice(0, 80);
  }

  function openCreate() {
    editingId = null;
    document.getElementById('flow-modal-title').textContent = 'New Bot Flow';
    document.getElementById('flow-id').value   = '';
    document.getElementById('f-keyword').value = '';
    document.getElementById('f-type').value    = 'text';
    document.getElementById('f-message').value = '';
    document.getElementById('f-buttons-json').value  = '';
    document.getElementById('f-sections-json').value = '';
    document.getElementById('f-active').checked = true;
    updateTypeFields('text');
    openModal('flow-modal');
  }

  async function edit(id) {
    editingId = id;
    try {
      const { flows } = await API.flows();
      const f = flows.find(x => x.id === id);
      if (!f) return;
      document.getElementById('flow-modal-title').textContent = 'Edit Bot Flow';
      document.getElementById('flow-id').value   = f.id;
      document.getElementById('f-keyword').value = f.trigger_keyword;
      document.getElementById('f-type').value    = f.response_type;
      document.getElementById('f-active').checked = f.active;

      const c = f.response_content || {};
      document.getElementById('f-message').value = c.message || '';
      document.getElementById('f-buttons-json').value  = c.buttons ? JSON.stringify(c.buttons, null, 2) : '';
      document.getElementById('f-sections-json').value = c.sections ? JSON.stringify(c.sections, null, 2) : '';

      updateTypeFields(f.response_type);
      openModal('flow-modal');
    } catch (err) { toast(err.message, 'error'); }
  }

  function updateTypeFields(type) {
    document.getElementById('f-text-group').style.display    = ['text','handoff','buttons','list'].includes(type) ? '' : 'none';
    document.getElementById('f-buttons-group').style.display = type === 'buttons' ? '' : 'none';
    document.getElementById('f-sections-group').style.display = type === 'list' ? '' : 'none';
  }

  async function save() {
    const id      = document.getElementById('flow-id').value;
    const type    = document.getElementById('f-type').value;
    const keyword = document.getElementById('f-keyword').value.trim().toLowerCase();
    const message = document.getElementById('f-message').value.trim();
    const active  = document.getElementById('f-active').checked;

    if (!keyword) { toast('Keyword is required', 'error'); return; }
    if (!message  && ['text','handoff'].includes(type)) { toast('Message is required', 'error'); return; }

    let content = { message };

    if (type === 'buttons') {
      try { content.buttons = JSON.parse(document.getElementById('f-buttons-json').value); }
      catch { toast('Buttons JSON is invalid', 'error'); return; }
    }
    if (type === 'list') {
      try { content.sections = JSON.parse(document.getElementById('f-sections-json').value); }
      catch { toast('Sections JSON is invalid', 'error'); return; }
    }

    const payload = { trigger_keyword: keyword, response_type: type, response_content: content, active };
    try {
      if (id) { await API.updateFlow(id, payload); toast('Flow updated'); }
      else    { await API.createFlow(payload);       toast('Flow created'); }
      closeModal('flow-modal');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function toggle(id) {
    try { await API.toggleFlow(id); }
    catch (err) { toast(err.message, 'error'); load(); }
  }

  async function remove(id, keyword) {
    if (!confirm(`Delete flow for keyword "${keyword}"?`)) return;
    try { await API.deleteFlow(id); toast('Deleted'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  function init() {
    document.getElementById('new-flow-btn').addEventListener('click', openCreate);
    document.getElementById('save-flow-btn').addEventListener('click', save);
    document.getElementById('f-type').addEventListener('change', (e) => updateTypeFields(e.target.value));
    load();
  }

  return { init, load, edit, toggle, remove };
})();
