/**
 * public/js/ui.js
 * Shared UI utilities: toasts, modal open/close, date formatting, badges.
 */

/* ── Toast ───────────────────────────────────────────────────────── */
function toast(msg, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
}

/* ── Modal ───────────────────────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Wire up all [data-close] buttons and overlay click-to-close
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

/* ── Date helpers ────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

/* ── Badge HTML ──────────────────────────────────────────────────── */
function statusBadge(status) {
  const map = {
    // Active / Success (White bg, Black text)
    open:      ['badge-active', 'Open'],
    sent:      ['badge-active', 'Sent'],
    delivered: ['badge-active', 'Delivered'],
    read:      ['badge-active', 'Read'],
    completed: ['badge-active', 'Completed'],
    admin:     ['badge-active', 'Admin'],
    agent:     ['badge-active', 'Agent'],

    // Inactive / Error (Transparent, White border)
    pending:   ['badge-inactive', 'Pending'],
    resolved:  ['badge-inactive', 'Resolved'],
    failed:    ['badge-inactive', 'Failed'],
    draft:     ['badge-inactive', 'Draft'],
    out:       ['badge-inactive', 'Opted Out'],

    // Warning / Intermediate (Dark gray bg)
    running:   ['badge-warning', 'Running'],
    scheduled: ['badge-warning', 'Scheduled'],
  };
  const [cls, label] = map[status] || ['badge', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ── Avatar initials ─────────────────────────────────────────────── */
function initials(name, fallback = '?') {
  if (!name) return fallback;
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ── Escape HTML to prevent XSS ─────────────────────────────────── */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Empty state helper ──────────────────────────────────────────── */
function emptyRow(cols, message = 'No results found') {
  return `<tr><td colspan="${cols}" class="loading-row" style="color:var(--text-3)">${message}</td></tr>`;
}
