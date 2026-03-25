/**
 * public/js/dashboard.js
 * Dashboard page: overview stats + Chart.js timeline chart.
 */

const DashboardPage = (() => {
  let chartInstance = null;

  function ensureChart() {
    return new Promise((resolve) => {
      if (window.Chart) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  async function load() {
    try {
      const [overview, timeline] = await Promise.all([
        API.analyticsOverview(),
        API.analyticsTimeline({ from: daysAgo(14), to: today(), direction: 'all' }),
      ]);

      // ── Stats ──────────────────────────────────────────────────
      const c = overview.contacts;
      const m = overview.messages;
      const v = overview.conversations;

      const stats = document.getElementById('dashboard-stats');
      stats.querySelectorAll('.stat-card').forEach(el => el.classList.remove('skeleton-pulse'));

      document.getElementById('stat-contacts').textContent   = c.total || 0;
      document.getElementById('stat-opted-in').innerHTML     = `<span class="delta-up">↑ ${c.opted_in || 0}</span> <span style="margin-left:4px">opted in</span>`;
      
      document.getElementById('stat-sent').textContent       = m.total_sent || 0;
      document.getElementById('stat-delivery').innerHTML     = `<span class="delta-up">↑ ${m.delivery_rate || '0%'}</span> <span style="margin-left:4px">delivery</span>`;
      
      document.getElementById('stat-read').textContent       = m.read || 0;
      document.getElementById('stat-read-rate').innerHTML    = `<span class="delta-up">↑ ${m.read_rate || '0%'}</span> <span style="margin-left:4px">read rate</span>`;
      
      document.getElementById('stat-open').textContent       = v.open || 0;
      document.getElementById('stat-conv-total').textContent = `${v.total || 0} total sessions`;

      // ── Timeline ───────────────────────────────────────────────
      await ensureChart();
      renderChart(timeline.timeline);

    } catch (err) {
      console.error('Dashboard load error:', err);
      toast('Failed to load dashboard data', 'error');
    }
  }

  function renderChart(timelineData) {
    const dateMap = {};
    timelineData.forEach(row => {
      if (!dateMap[row.date]) dateMap[row.date] = { inbound: 0, outbound: 0 };
      dateMap[row.date][row.direction] = row.count;
    });

    const labels   = Object.keys(dateMap).sort();
    const inbound  = labels.map(d => dateMap[d].inbound  || 0);
    const outbound = labels.map(d => dateMap[d].outbound || 0);

    const canvas = document.getElementById('timeline-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartInstance) { chartInstance.destroy(); }

    const isDark = !document.documentElement.classList.contains('light');
    const accent = '#6366f1';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#9ca3af' : '#64748b';

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Messages Sent',
            data: outbound,
            borderColor: accent,
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
          },
          {
            label: 'Messages Received',
            data: inbound,
            borderColor: isDark ? '#94a3b8' : '#475569',
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [5, 5],
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            display: true, 
            position: 'top',
            align: 'end',
            labels: { color: textColor, boxWidth: 12, usePointStyle: true, font: { family: 'Geist Sans', size: 11 } } 
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            titleColor: isDark ? '#ffffff' : '#000000',
            bodyColor: isDark ? '#9ca3af' : '#475569',
            borderColor: isDark ? '#374151' : '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            boxPadding: 4,
          }
        },
        scales: {
          x: { 
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 } }
          },
          y: { 
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 5 }
          },
        },
      },
    });
  }

  function today() { return new Date().toISOString().slice(0,10); }
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0,10);
  }

  function init() {
    document.getElementById('refresh-stats-btn').addEventListener('click', () => {
      const btn = document.getElementById('refresh-stats-btn');
      btn.disabled = true;
      load().finally(() => btn.disabled = false);
    });
    load();
  }

  return { init, load };
})();
