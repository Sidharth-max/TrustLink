/**
 * public/js/broadcasts.js
 * Broadcasts page: list, create, send, delete.
 */

const BroadcastsPage = (() => {

  async function load() {
    const tbody = document.getElementById('broadcasts-tbody');
    tbody.innerHTML = `<tr><td colspan="8" class="loading-row"><div class="spinner"></div></td></tr>`;
    try {
      const { broadcasts } = await API.broadcasts();
      if (!broadcasts.length) { tbody.innerHTML = emptyRow(8, 'No broadcasts yet'); return; }

      tbody.innerHTML = broadcasts.map(b => `
        <tr>
          <td data-label="Name"><strong>${esc(b.name)}</strong></td>
          <td data-label="Template"><code style="font-size:.78rem">${esc(b.template_name)}</code></td>
          <td data-label="Segment">${b.segment_tag ? `<span class="badge">${esc(b.segment_tag)}</span>` : '<span class="text-muted">All</span>'}</td>
          <td data-label="Status">${statusBadge(b.status)}</td>
          <td data-label="Sent">${b.sent_count ?? 0}</td>
          <td data-label="Failed">${b.failed_count || '0'}</td>
          <td data-label="Created">${fmtDate(b.created_at)}</td>
          <td data-label="Actions">
            <div style="display:flex;gap:6px;">
              ${['draft','scheduled','failed'].includes(b.status)
                ? `<button class="btn btn-primary btn-sm" onclick="BroadcastsPage.send(${b.id},'${esc(b.name)}')">▶ Send</button>`
                : ''}
              ${['draft','scheduled'].includes(b.status)
                ? `<button class="btn btn-ghost btn-sm" onclick="BroadcastsPage.remove(${b.id},'${esc(b.name)}')">🗑️</button>`
                : ''}
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = emptyRow(8, 'Failed to load');
      console.error(err);
    }
  }

  async function create() {
    const name     = document.getElementById('b-name').value.trim();
    const template = document.getElementById('b-template').value.trim();
    const lang     = document.getElementById('b-lang').value.trim() || 'en_US';
    const segment  = document.getElementById('b-segment').value.trim();
    const recipients = document.getElementById('b-recipients').value.trim();
    const schedule = document.getElementById('b-schedule').value;

    if (!name || !template) { toast('Name and template are required', 'error'); return; }

    try {
      await API.createBroadcast({
        name, template_name: template, language_code: lang,
        segment_tag: segment,
        recipients,
        scheduled_at: schedule || null,
      });
      toast('Broadcast created');
      closeModal('broadcast-modal');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function send(id, name) {
    if (!confirm(`Send broadcast "${name}" now to all matching contacts?`)) return;
    try {
      toast('Sending broadcast…');
      const res = await API.sendBroadcast(id);
      toast(`Done! Sent: ${res.sent}, Failed: ${res.failed}`);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id, name) {
    if (!confirm(`Delete broadcast "${name}"?`)) return;
    try {
      await API.deleteBroadcast(id);
      toast('Deleted');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  function init() {
    document.getElementById('new-broadcast-btn').addEventListener('click', () => {
      document.getElementById('b-name').value     = '';
      document.getElementById('b-template').value = '';
      document.getElementById('b-lang').value     = 'en_US';
      document.getElementById('b-segment').value   = '';
      document.getElementById('b-recipients').value = '';
      document.getElementById('b-schedule').value  = '';
      openModal('broadcast-modal');
    });
    document.getElementById('save-broadcast-btn').addEventListener('click', create);
    load();
  }

  return { init, load, send, remove };
})();
