/**
 * public/js/ui.js
 * Visual utilities: Toasts, Badges, Modals, Skeletal Loading.
 */

// ── Toasts ────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  
  // Icon based on type
  let icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  if (type === 'error') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  
  el.innerHTML = `${icon} <span>${msg}</span>`;
  container.appendChild(el);

  // Auto-remove
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ── Badges ────────────────────────────────────────────────────────
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (['open', 'active', 'sent', 'delivered', 'read'].includes(s)) 
    return `<span class="badge badge-green">${status}</span>`;
  if (['pending', 'in review', 'draft', 'scheduled'].includes(s)) 
    return `<span class="badge badge-amber">${status}</span>`;
  if (['failed', 'error', 'closed', 'expired'].includes(s)) 
    return `<span class="badge badge-red">${status}</span>`;
  return `<span class="badge badge-indigo">${status}</span>`;
}

// ── Modals ────────────────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = bodyHtml;
  document.getElementById('modal-footer').innerHTML  = footerHtml;
  document.getElementById('modal-overlay').classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.classList.remove('modal-open');
}

// ── Form Helpers ──────────────────────────────────────────────────
function getFormData(formId) {
  const form = document.getElementById(formId);
  const data = {};
  new FormData(form).forEach((val, key) => { data[key] = val; });
  return data;
}

// ── Formatting ────────────────────────────────────────────────────
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initials(name, fallback = '?') {
  if (!name) return fallback;
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(iso) {
  if (!iso) return '—';
  const SEC = 1000, MIN = 60 * SEC, HR = 60 * MIN, DAY = 24 * HR;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MIN) return 'just now';
  if (diff < HR) return Math.floor(diff / MIN) + 'm ago';
  if (diff < DAY) return Math.floor(diff / HR) + 'h ago';
  return Math.floor(diff / DAY) + 'd ago';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Skeletal Loading ──────────────────────────────────────────────
function showSkeletons(containerId, count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-pulse" style="padding:16px; border-bottom:1px solid var(--border); display:flex; gap:12px;">
        <div class="skeleton" style="width:40px; height:40px; border-radius:10px;"></div>
        <div style="flex:1;">
          <div class="skeleton" style="width:60%; height:14px; margin-bottom:8px;"></div>
          <div class="skeleton" style="width:40%; height:10px;"></div>
        </div>
      </div>`;
  }
  container.innerHTML = html;
}
// ── Guided Empty States ──────────────────────────────────────────
function renderEmptyState(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    title = 'No data available',
    text = 'Start by adding your first record.',
    cta1 = null, // { label, onclick }
    cta2 = null
  } = options;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-graphic" style="color:var(--primary); opacity:0.8;">${icon}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      <div style="display:flex; gap:12px; margin-top:12px;">
        ${cta1 ? `<button class="btn btn-primary" id="${containerId}-cta1">${esc(cta1.label)}</button>` : ''}
        ${cta2 ? `<button class="btn btn-secondary" id="${containerId}-cta2">${esc(cta2.label)}</button>` : ''}
      </div>
    </div>
  `;

  if (cta1) document.getElementById(`${containerId}-cta1`).onclick = cta1.onclick;
  if (cta2) document.getElementById(`${containerId}-cta2`).onclick = cta2.onclick;
}

// ── Tab Management ──────────────────────────────────────────────
function initTabs(containerSelector, callback) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.querySelectorAll('[data-filter]').forEach(tab => {
    tab.onclick = () => {
      container.querySelectorAll('[data-filter]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      callback(tab.dataset.filter);
    };
  });
}
