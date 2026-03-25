/**
 * public/js/broadcasts.js
 * Broadcasts page: list of campaigns in a card grid + creation flow.
 */

const BroadcastsPage = (() => {
  let allContactsCount = 0;

  async function load() {
    const grid = document.getElementById('broadcast-grid');
    grid.innerHTML = '';
    showSkeletons('broadcast-grid', 4);

    try {
      const { broadcasts } = await API.analyticsBroadcasts();
      if (broadcasts.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-graphic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></div>
            <h3>No campaigns yet</h3>
            <p>Ready to reach your audience? Create your first broadcast campaign now.</p>
            <button class="btn btn-primary" onclick="BroadcastsPage.openCreate()">Create Broadcast</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = broadcasts.map(b => {
        const total   = b.sent_count + b.failed_count;
        const percent = total > 0 ? Math.round((b.sent_count / total) * 100) : 0;
        const status  = b.status.toLowerCase();
        
        return `
          <div class="card broadcast-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
              <div>
                <h4 style="font-size:16px; margin-bottom:4px;">${esc(b.name)}</h4>
                <div style="font-size:12px; color:var(--text-secondary)">${fmtDate(b.created_at)} • ${esc(b.type)}</div>
              </div>
              ${statusBadge(b.status)}
            </div>
            
            <div style="margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                <span>Progress</span>
                <span style="font-weight:600;">${percent}%</span>
              </div>
              <div style="height:6px; background:var(--bg); border-radius:10px; overflow:hidden;">
                <div style="height:100%; width:${percent}%; background:var(--primary); transition:width 1s ease;"></div>
              </div>
            </div>

            <div style="display:flex; gap:16px; margin-bottom:20px;">
              <div style="flex:1;">
                <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Sent</div>
                <div style="font-size:18px; font-weight:600;">${b.sent_count}</div>
              </div>
              <div style="flex:1;">
                <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Failed</div>
                <div style="font-size:18px; font-weight:600; color:var(--error);">${b.failed_count}</div>
              </div>
            </div>

            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="BroadcastsPage.viewDetails(${b.id})">Details</button>
              ${status === 'draft' ? `<button class="btn btn-primary btn-sm" style="flex:1;" onclick="BroadcastsPage.sendNow(${b.id})">Send Now</button>` : ''}
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>Failed to load broadcasts</p><button class="btn btn-secondary" onclick="BroadcastsPage.load()">Retry</button></div>';
    }
  }

  function openCreate() {
    const body = `
      <form id="broadcast-form" style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <label class="stat-label">Campaign Name</label>
          <input type="text" name="name" placeholder="e.g. Diwali Greeting 2024" required>
        </div>
        <div>
          <label class="stat-label">Template Name</label>
          <input type="text" name="template" placeholder="e.g. hello_world" required>
        </div>
        <div>
          <label class="stat-label">Recipients (one per line)</label>
          <textarea name="recipients" rows="5" placeholder="919876543210\n918877665544" required></textarea>
        </div>
        <p style="font-size:12px; color:var(--text-muted)">Max 500 recipients per broadcast.</p>
      </form>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="submit-broadcast-btn">Create &amp; Send</button>
    `;
    openModal('New Broadcast Campaign', body, footer);

    document.getElementById('submit-broadcast-btn').onclick = async () => {
      const data = getFormData('broadcast-form');
      const btn = document.getElementById('submit-broadcast-btn');
      btn.disabled = true; btn.textContent = 'Processing...';

      try {
        await API.createBroadcast({
          name: data.name,
          template_name: data.template,
          recipients: data.recipients.split('\n').map(r => r.trim()).filter(Boolean)
        });
        toast('Broadcast started!');
        closeModal();
        load();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Create & Send';
      }
    };
  }

  function viewDetails(id) {
    toast(`Details for campaign #${id} coming soon`, 'info');
  }

  async function sendNow(id) {
    toast(`Sending campaign #${id}...`, 'info');
    // Implement API call if/when backend supports re-triggering drafts
  }

  function init() {
    document.getElementById('new-broadcast-btn').addEventListener('click', openCreate);
    load();
    // Refresh every 30s during active sessions
    setInterval(load, 30000);
  }

  return { init, load, openCreate, viewDetails, sendNow };
})();
