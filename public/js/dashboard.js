/**
 * public/js/dashboard.js
 * Dashboard page: overview stats + Chart.js timeline chart + broadcast stats table.
 * Uses Chart.js loaded from CDN (injected dynamically so only loaded when needed).
 */

const DashboardPage = (() => {
  let chartInstance = null;

  // Ensure Chart.js is available (lazy load from CDN)
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
      const [overview, timeline, broadcasts] = await Promise.all([
        API.analyticsOverview(),
        API.analyticsTimeline({ from: daysAgo(30), to: today(), direction: 'all' }),
        API.analyticsBroadcasts(),
      ]);

      // ── Stats cards ────────────────────────────────────────────
      const c = overview.contacts;
      const m = overview.messages;
      const v = overview.conversations;

      document.getElementById('stat-contacts').textContent   = c.total || 0;
      document.getElementById('stat-opted-in').textContent   = `${c.opted_in || 0} opted in`;
      document.getElementById('stat-sent').textContent       = m.total_sent || 0;
      document.getElementById('stat-delivery').textContent   = `${m.delivery_rate || '0%'} delivery rate`;
      document.getElementById('stat-read').textContent       = m.read || 0;
      document.getElementById('stat-read-rate').textContent  = `${m.read_rate || '0%'} read rate`;
      document.getElementById('stat-open').textContent       = v.open || 0;
      document.getElementById('stat-conv-total').textContent = `${v.total || 0} total`;

      // ── Timeline chart ─────────────────────────────────────────
      await ensureChart();
      renderChart(timeline.timeline);

      // ── Broadcast stats table ──────────────────────────────────
      const tbody = document.getElementById('broadcast-stats-body');
      if (!broadcasts.broadcasts.length) {
        tbody.innerHTML = emptyRow(6, 'No completed broadcasts yet');
      } else {
        tbody.innerHTML = broadcasts.broadcasts.slice(0, 10).map(b => `
          <tr>
            <td data-label="Name">${esc(b.name)}</td>
            <td data-label="Template"><code style="font-size:.78rem">${esc(b.template_name)}</code></td>
            <td data-label="Sent">${b.sent_count || 0}</td>
            <td data-label="Failed">${b.failed_count || 0}</td>
            <td data-label="Success">${b.success_rate || 0}%</td>
            <td data-label="Status">${statusBadge(b.status)}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  function renderChart(timelineData) {
    // Group by date summing counts per direction
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

    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor = dark ? '#2a3942' : '#e4e6ea';
    const textColor = dark ? '#8696a0' : '#54656f';

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Sent', data: outbound, backgroundColor: '#25D36688', borderRadius: 4 },
          { label: 'Received', data: inbound, backgroundColor: '#1d72b888', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { stacked: true, ticks: { color: textColor, maxTicksLimit: 10 }, grid: { color: gridColor } },
          y: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } },
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
    document.getElementById('refresh-stats-btn').addEventListener('click', load);
    load();
  }

  return { init, load };
})();
