/**
 * public/js/app.js
 * Application bootstrap: handles auth, routing, and shared UI (sidebar, theme).
 */

(() => {
  let currentPage = localStorage.getItem('lastPage') || 'dashboard';
  let currentUser = null;

  const pageModules = {
    dashboard: DashboardPage,
    inbox:     InboxPage,
    contacts:  ContactsPage,
    broadcasts: BroadcastsPage,
    bot:       BotPage,
    agents:    AgentsPage,
  };
  const initialized = {};

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
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('app').classList.remove('ready');
  }

  function showApp(agent) {
    document.getElementById('login-page').style.display = 'none';
    const app = document.getElementById('app');
    app.classList.add('ready');
    app.style.display = 'flex';

    // Sidebar Identity
    document.getElementById('sidebar-name').textContent   = agent.name;
    document.getElementById('sidebar-role').textContent   = agent.role;
    document.getElementById('sidebar-avatar').textContent = initials(agent.name);

    if (agent.role !== 'admin') {
      const nav = document.getElementById('agents-nav-item');
      if (nav) nav.style.display = 'none';
    }

    navigateTo(currentPage);
  }

  // ── Login ─────────────────────────────────────────────────────────
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-btn');
    const errEl    = document.getElementById('login-error');
    
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Signing in…';

    try {
      const { agent } = await API.login(email, password);
      currentUser = agent;
      showApp(agent);
    } catch (err) {
      errEl.textContent = err.message || 'Invalid credentials';
      errEl.style.display = 'flex';
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });

  function handleLogout() {
    API.logout().catch(() => {});
    showLogin();
  }

  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);

  // ── Navigation ────────────────────────────────────────────────────
  function navigateTo(page) {
    if (!document.getElementById(`page-${page}`)) page = 'dashboard';
    currentPage = page;
    localStorage.setItem('lastPage', page);

    // Turn off 'chat-active' mode globally when navigating elsewhere
    document.body.classList.remove('chat-active');
    
    // Reset specific chat layouts
    const inboxPage = document.getElementById('page-inbox');
    if (inboxPage) inboxPage.classList.remove('show-chat');

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Sidebar & Bottom Nav Active State
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === page);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === page);
    });

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');

    // Init page module
    if (pageModules[page] && !initialized[page]) {
      pageModules[page].init();
      initialized[page] = true;
    } else if (pageModules[page]) {
      pageModules[page].load?.();
    }
  }

  document.querySelectorAll('.nav-item[data-page], .bottom-nav-item[data-page]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    };
  });

  // ── Sidebar Toggle ────────────────────────────────────────────────
  function initSidebar() {
    // We'll add a mobile toggle button in a header if needed, 
    // but for now the sidebar is fixed on PC and hidden on mobile via CSS.
  }

  // ── Theme ─────────────────────────────────────────────────────────
  function initTheme() {
    let saved = localStorage.getItem('theme');
    if (!saved) {
      saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.className = saved;
    updateThemeIcons();
  }
  function updateThemeIcons() {
    const isLight = document.documentElement.classList.contains('light');
    document.getElementById('sun-icon').style.display  = isLight ? 'none' : 'block';
    document.getElementById('moon-icon').style.display = isLight ? 'block' : 'none';
  }
  document.getElementById('theme-toggle').onclick = () => {
    const isLight = document.documentElement.classList.toggle('light');
    document.documentElement.classList.toggle('dark', !isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcons();
    
    // Auto-refresh dashboard chart to adopt new theme colors
    if (currentPage === 'dashboard' && window.DashboardPage) {
      DashboardPage.load();
    }
  };

  // ── Init ──────────────────────────────────────────────────────────
  initTheme();
  checkAuth();
  initSidebar();

  window.app = { showPage: navigateTo };
})();
