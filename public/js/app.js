/**
 * public/js/app.js
 * Application bootstrap: handles login/logout, session check, page routing.
 * This script runs last (loaded after all page modules).
 */

(() => {
  // Current active page key
  let currentPage = 'dashboard';
  let currentUser = null;

  // Map of page keys → page module init functions
  const pageModules = {
    dashboard: DashboardPage,
    inbox:     InboxPage,
    contacts:  ContactsPage,
    broadcasts: BroadcastsPage,
    bot:       BotPage,
    agents:    AgentsPage,
  };
  const initialized = {};

  // ── Auth ──────────────────────────────────────────────────────────
  async function checkAuth() {
    try {
      const { agent } = await API.me();
      currentUser = agent;
      showApp(agent);
    } catch (_) {
      showLogin();
    }
  }

  function showLogin() {
    document.getElementById('login-page').style.display = 'grid';
    document.getElementById('app').classList.remove('ready');
  }

  function showApp(agent) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').classList.add('ready');

    // Populate sidebar identity
    document.getElementById('sidebar-name').textContent   = agent.name;
    document.getElementById('sidebar-role').textContent   = agent.role;
    document.getElementById('sidebar-avatar').textContent = initials(agent.name);

    // Hide agents nav for non-admins
    if (agent.role !== 'admin') {
      document.getElementById('agents-nav-item').style.display = 'none';
    }

    navigateTo(currentPage);
  }

  // ── Login form ────────────────────────────────────────────────────
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-btn');
    const errEl    = document.getElementById('login-error');
    errEl.classList.remove('show');
    btn.disabled = true; btn.textContent = 'Signing in…';

    try {
      const { agent } = await API.login(email, password);
      currentUser = agent;
      showApp(agent);
    } catch (err) {
      errEl.textContent = err.message || 'Invalid credentials';
      errEl.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });

  // ── Logout ────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await API.logout().catch(() => {});
    currentUser = null;
    showLogin();
  });

  // ── Navigation ────────────────────────────────────────────────────
  function navigateTo(page) {
    // Validate page exists
    if (!document.getElementById(`page-${page}`)) page = 'dashboard';
    currentPage = page;

    // Show/hide pages
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Highlight nav items (sidebar + bottom nav)
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Init the page module once
    if (pageModules[page] && !initialized[page]) {
      pageModules[page].init();
      initialized[page] = true;
    }
  }

  // Wire nav items (sidebar)
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });
  // Wire bottom nav items (mobile)
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // ── Boot ──────────────────────────────────────────────────────────
  checkAuth();
})();
