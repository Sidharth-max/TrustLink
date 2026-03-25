/**
 * public/js/contacts.js
 * Contacts page: audience management, CRM-style table, and CSV import.
 * Redesigned for Premium Indigo/Slate.
 */

const ContactsPage = (() => {
  let contacts = [];

  async function load() {
    const tbody = document.getElementById('contact-tbody');
    tbody.innerHTML = '<tr><td colspan="4"><div class="loading-row"><div class="spinner"></div></div></td></tr>';

    try {
      const data = await API.contacts();
      contacts = data.contacts || [];
      document.getElementById('contact-count-label').textContent = `${contacts.length} total recipients`;

      if (contacts.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4">
              <div class="empty-state">
                <div class="empty-graphic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
                <h3>No contacts found</h3>
                <p>Start building your audience by adding a contact or importing a CSV file.</p>
                <button class="btn btn-primary" onclick="ContactsPage.openAdd()">Add Your First Contact</button>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = contacts.map(c => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="logo-box" style="width:32px; height:32px; background:var(--surface-3); font-size:12px;">${initials(c.name)}</div>
              <div>
                <div style="font-weight:600;">${esc(c.name || '—')}</div>
                <div style="font-size:11px; color:var(--text-muted)">ID: ${c.id}</div>
              </div>
            </div>
          </td>
          <td><code style="font-family:'Geist Mono',monospace; opacity:0.8;">${esc(c.phone)}</code></td>
          <td>${c.opted_in ? '<span class="badge badge-green">Opted In</span>' : '<span class="badge badge-red">Opted Out</span>'}</td>
          <td>
             <div style="display:flex; gap:8px;">
               <button class="btn btn-secondary btn-icon btn-sm" onclick="ContactsPage.openEdit(${c.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
               <button class="btn btn-secondary btn-icon btn-sm" style="color:var(--error)" onclick="ContactsPage.delete(${c.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
             </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Failed to load contacts.</div></td></tr>';
    }
  }

  function openAdd() {
    const body = `
      <form id="contact-form" style="display:flex; flex-direction:column; gap:16px;">
        <div><label class="stat-label">Full Name</label><input type="text" name="name" required></div>
        <div><label class="stat-label">Phone (include country code)</label><input type="text" name="phone" placeholder="919876543210" required></div>
        <div><label class="stat-label">Tags (comma separated)</label><input type="text" name="tags" placeholder="premium, active"></div>
      </form>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-contact-btn">Save Contact</button>
    `;
    openModal('New Contact', body, footer);
    document.getElementById('save-contact-btn').onclick = save;
  }

  async function save() {
    const data = getFormData('contact-form');
    try {
      await API.createContact(data);
      toast('Contact saved');
      closeModal();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteContact(id) {
    if (!confirm('Are you sure?')) return;
    try {
      await API.deleteContact(id);
      toast('Contact deleted');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  function init() {
    document.getElementById('add-contact-btn').onclick = openAdd;
    document.getElementById('import-csv-btn').onclick = () => toast('CSV import coming soon in this UI variant', 'info');
    load();
  }

  return { init, load, openAdd, delete: deleteContact };
})();
