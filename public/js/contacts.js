/**
 * public/js/contacts.js
 * Contacts page: list, search, filter, add/edit/delete, CSV import.
 */

const ContactsPage = (() => {
  let currentPage = 1;
  let searchTimer = null;
  let editingId   = null;

  function getFilters() {
    return {
      search:   document.getElementById('contact-search').value.trim(),
      tag:      document.getElementById('contact-tag-filter').value,
      opted_in: document.getElementById('contact-optin-filter').value,
      page:     currentPage,
      limit:    50,
    };
  }

  async function loadTags() {
    try {
      const { tags } = await API.tags();
      const sel = document.getElementById('contact-tag-filter');
      // Preserve existing selection
      const cur = sel.value;
      sel.innerHTML = '<option value="">All tags</option>';
      tags.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        if (t === cur) opt.selected = true;
        sel.appendChild(opt);
      });
    } catch (_) {}
  }

  async function load() {
    const tbody = document.getElementById('contacts-tbody');
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><div class="spinner"></div></td></tr>`;

    try {
      const filters = getFilters();
      // Remove empty params
      Object.keys(filters).forEach(k => { if (!filters[k] && filters[k] !== 0) delete filters[k]; });

      const { contacts, pagination } = await API.contacts(filters);

      document.getElementById('contact-count-label').textContent = `${pagination.total} contacts`;

      if (contacts.length === 0) {
        tbody.innerHTML = emptyRow(7, 'No contacts found');
        document.getElementById('contacts-pagination').innerHTML = '';
        return;
      }

      tbody.innerHTML = contacts.map(c => `
        <tr data-id="${c.id}" data-phone="${esc(c.phone)}">
          <td><input type="checkbox" class="contact-select" value="${esc(c.phone)}" /></td>
          <td data-label="Name">${esc(c.name || '—')}</td>
          <td data-label="Phone"><code style="font-size:.8rem">${esc(c.phone)}</code></td>
          <td data-label="Tags">${c.tags ? c.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="badge" style="margin:1px">${esc(t)}</span>`).join('') : '—'}</td>
          <td data-label="Status">${c.opted_in ? '<span class="badge badge-active">Opted In</span>' : '<span class="badge badge-inactive">Opted Out</span>'}</td>
          <td data-label="Added">${fmtDate(c.created_at)}</td>
          <td data-label="Actions">
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="ContactsPage.edit(${c.id})" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-sm" onclick="ContactsPage.remove(${c.id},'${esc(c.name||c.phone)}')" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');

      renderPagination(pagination);
      updateSelectionUI();
    } catch (err) {
      tbody.innerHTML = emptyRow(7, 'Failed to load contacts');
      console.error(err);
    }
  }

  function renderPagination({ page, pages, total }) {
    const el = document.getElementById('contacts-pagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <span>${total} total</span>
      <button class="btn btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="ContactsPage.goPage(${page - 1})">← Prev</button>
      <span>Page ${page} of ${pages}</span>
      <button class="btn btn-secondary btn-sm" ${page >= pages ? 'disabled' : ''} onclick="ContactsPage.goPage(${page + 1})">Next →</button>
    `;
  }

  function goPage(p) { currentPage = p; load(); }

  function openAdd() {
    editingId = null;
    document.getElementById('contact-modal-title').textContent = 'Add Contact';
    document.getElementById('contact-id').value = '';
    document.getElementById('c-name').value     = '';
    document.getElementById('c-phone').value    = '';
    document.getElementById('c-tags').value     = '';
    document.getElementById('c-opted-in').checked = true;
    openModal('contact-modal');
  }

  async function edit(id) {
    editingId = id;
    document.getElementById('contact-modal-title').textContent = 'Edit Contact';
    try {
      const { contact } = await API.contact(id);
      document.getElementById('contact-id').value  = contact.id;
      document.getElementById('c-name').value      = contact.name || '';
      document.getElementById('c-phone').value     = contact.phone;
      document.getElementById('c-tags').value      = contact.tags || '';
      document.getElementById('c-opted-in').checked = contact.opted_in;
      openModal('contact-modal');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function save() {
    const id      = document.getElementById('contact-id').value;
    const payload = {
      name:     document.getElementById('c-name').value.trim(),
      phone:    document.getElementById('c-phone').value.trim(),
      tags:     document.getElementById('c-tags').value.trim(),
      opted_in: document.getElementById('c-opted-in').checked,
    };
    if (!payload.phone) { toast('Phone is required', 'error'); return; }
    try {
      if (id) {
        await API.updateContact(id, payload);
        toast('Contact updated');
      } else {
        await API.createContact(payload);
        toast('Contact added');
      }
      closeModal('contact-modal');
      load(); loadTags();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id, nameLabel) {
    if (!confirm(`Delete contact "${nameLabel}"? This cannot be undone.`)) return;
    try {
      await API.deleteContact(id);
      toast('Contact deleted');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function doImport() {
    const file = document.getElementById('csv-file-input').files[0];
    if (!file) { toast('Please select a CSV file', 'error'); return; }
    const fd = new FormData();
    fd.append('file', file);
    const btn = document.getElementById('do-csv-import-btn');
    btn.disabled = true; btn.textContent = 'Importing…';
    try {
      const res = await API.importCSV(fd);
      const resultEl = document.getElementById('csv-result');
      resultEl.style.display = 'block';
      resultEl.innerHTML = `
        <div class="card" style="background:var(--surface-2);">
          <div>✅ Imported: <strong>${res.imported}</strong></div>
          <div>⚠️ Skipped: <strong>${res.skipped}</strong></div>
          ${res.errors.length ? `<div style="margin-top:8px;font-size:.78rem;color:var(--red)">${res.errors.slice(0,5).map(e=>`Line ${e.line}: ${e.reason}`).join('<br>')}</div>` : ''}
        </div>`;
      toast(`Imported ${res.imported} contacts`);
      load(); loadTags();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Import'; }
  }

  function init() {
    document.getElementById('add-contact-btn').addEventListener('click', openAdd);
    document.getElementById('save-contact-btn').addEventListener('click', save);
    document.getElementById('import-csv-btn').addEventListener('click', () => {
      document.getElementById('csv-result').style.display = 'none';
      document.getElementById('csv-file-input').value = '';
      openModal('csv-modal');
    });
    document.getElementById('do-csv-import-btn').addEventListener('click', doImport);

    // Selection logic
    document.getElementById('contact-select-all').addEventListener('change', (e) => {
      document.querySelectorAll('.contact-select').forEach(cb => cb.checked = e.target.checked);
      updateSelectionUI();
    });

    document.getElementById('contacts-tbody').addEventListener('change', (e) => {
      if (e.target.classList.contains('contact-select')) {
        updateSelectionUI();
      }
    });

    document.getElementById('broadcast-selected-btn').addEventListener('click', () => {
      const selected = Array.from(document.querySelectorAll('.contact-select:checked')).map(cb => cb.value);
      if (selected.length === 0) return;
      
      // Open broadcast page and pre-fill recipients
      app.showPage('broadcasts');
      document.getElementById('b-recipients').value = selected.join(', ');
      openModal('broadcast-modal');
    });

    // Search with debounce
    document.getElementById('contact-search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { currentPage = 1; load(); }, 350);
    });
    document.getElementById('contact-tag-filter').addEventListener('change', () => { currentPage = 1; load(); });
    document.getElementById('contact-optin-filter').addEventListener('change', () => { currentPage = 1; load(); });

    loadTags();
    load();
  }

  function updateSelectionUI() {
    const selected = document.querySelectorAll('.contact-select:checked');
    const btn = document.getElementById('broadcast-selected-btn');
    btn.style.display = selected.length > 0 ? 'flex' : 'none';
    if (selected.length > 0) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Broadcast (${selected.length})`;
    }
  }

  return { init, load, edit, remove, goPage };
})();
