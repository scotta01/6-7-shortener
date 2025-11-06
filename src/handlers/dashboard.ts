/**
 * Analytics Dashboard Handler
 * Provides a web UI for viewing URL statistics
 */

/**
 * Handler for GET /dashboard
 * Serves the analytics dashboard HTML
 */
export async function handleDashboard(): Promise<Response> {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL Shortener - Analytics Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
      color: #667eea;
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .subtitle {
      color: #666;
      font-size: 1.1em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .stat-label {
      color: #888;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }

    .stat-value {
      color: #333;
      font-size: 2.5em;
      font-weight: bold;
    }

    .urls-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .section-title {
      color: #333;
      font-size: 1.8em;
      margin-bottom: 20px;
    }

    .search-box {
      width: 100%;
      padding: 12px 20px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1em;
      margin-bottom: 20px;
      transition: border-color 0.3s;
    }

    .search-box:focus {
      outline: none;
      border-color: #667eea;
    }

    .url-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .url-item {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      transition: all 0.3s;
    }

    .url-item:hover {
      border-color: #667eea;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
    }

    .url-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .short-code {
      font-size: 1.3em;
      font-weight: bold;
      color: #667eea;
      font-family: 'Courier New', monospace;
    }

    .badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: bold;
      text-transform: uppercase;
    }

    .badge-custom {
      background: #ffeaa7;
      color: #d63031;
    }

    .badge-auto {
      background: #dfe6e9;
      color: #2d3436;
    }

    .original-url {
      color: #666;
      word-break: break-all;
      margin-bottom: 15px;
      font-size: 0.95em;
    }

    .url-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      padding-top: 15px;
      border-top: 1px solid #f0f0f0;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      color: #888;
      font-size: 0.8em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .meta-value {
      color: #333;
      font-weight: 500;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
      font-size: 1.2em;
    }

    .error {
      background: #ff6b6b;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }

    .empty-state-icon {
      font-size: 4em;
      margin-bottom: 20px;
    }

    .refresh-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 1em;
      cursor: pointer;
      transition: background 0.3s;
      margin-bottom: 20px;
    }

    .refresh-btn:hover {
      background: #5568d3;
    }

    .visits-highlight {
      color: #667eea;
      font-weight: bold;
      font-size: 1.2em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Analytics Dashboard</h1>
      <p class="subtitle">Real-time URL shortener analytics</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total URLs</div>
        <div class="stat-value" id="total-urls">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Visits</div>
        <div class="stat-value" id="total-visits">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Custom Codes</div>
        <div class="stat-value" id="custom-codes">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg. Visits/URL</div>
        <div class="stat-value" id="avg-visits">-</div>
      </div>
    </div>

    <div class="urls-section">
      <button class="refresh-btn" onclick="loadDashboard()">🔄 Refresh Data</button>
      <h2 class="section-title">URL Statistics</h2>
      <input type="text" class="search-box" id="search-input" placeholder="Search by short code or URL...">
      <div id="url-list" class="url-list">
        <div class="loading">Loading dashboard data...</div>
      </div>
    </div>
  </div>

  <script>
    let allUrls = [];

    // Format date
    function formatDate(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    // Format time ago
    function timeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);

      if (seconds < 60) return seconds + 's ago';
      if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
      if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
      return Math.floor(seconds / 86400) + 'd ago';
    }

    // Render URL list
    function renderUrls(urls) {
      const container = document.getElementById('url-list');

      if (urls.length === 0) {
        container.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3>No URLs found</h3>
            <p>Create your first short URL to see it here!</p>
          </div>
        \`;
        return;
      }

      container.innerHTML = urls.map(url => \`
        <div class="url-item">
          <div class="url-header">
            <span class="short-code">\${url.shortCode}</span>
            <span class="badge \${url.customCode ? 'badge-custom' : 'badge-auto'}">
              \${url.customCode ? 'Custom' : 'Auto'}
            </span>
          </div>
          <div class="original-url">\${url.originalUrl}</div>
          <div class="url-meta">
            <div class="meta-item">
              <span class="meta-label">Visits</span>
              <span class="meta-value visits-highlight">\${url.visitCount.toLocaleString()}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Created</span>
              <span class="meta-value">\${timeAgo(url.createdAt)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Expires</span>
              <span class="meta-value">\${url.expiresAt ? formatDate(url.expiresAt) : 'Never'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <span class="meta-value">\${url.isExpired ? '❌ Expired' : '✅ Active'}</span>
            </div>
          </div>
        </div>
      \`).join('');
    }

    // Update stats
    function updateStats(urls) {
      const totalUrls = urls.length;
      const totalVisits = urls.reduce((sum, url) => sum + url.visitCount, 0);
      const customCodes = urls.filter(url => url.customCode).length;
      const avgVisits = totalUrls > 0 ? (totalVisits / totalUrls).toFixed(1) : 0;

      document.getElementById('total-urls').textContent = totalUrls.toLocaleString();
      document.getElementById('total-visits').textContent = totalVisits.toLocaleString();
      document.getElementById('custom-codes').textContent = customCodes.toLocaleString();
      document.getElementById('avg-visits').textContent = avgVisits;
    }

    // Search functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = allUrls.filter(url =>
        url.shortCode.toLowerCase().includes(query) ||
        url.originalUrl.toLowerCase().includes(query)
      );
      renderUrls(filtered);
    });

    // Load dashboard data
    async function loadDashboard() {
      const container = document.getElementById('url-list');
      container.innerHTML = '<div class="loading">Loading dashboard data...</div>';

      try {
        const response = await fetch('/api/dashboard/urls');

        if (!response.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const data = await response.json();
        allUrls = data.urls || [];

        // Sort by visit count descending
        allUrls.sort((a, b) => b.visitCount - a.visitCount);

        updateStats(allUrls);
        renderUrls(allUrls);
      } catch (error) {
        container.innerHTML = \`
          <div class="error">
            Failed to load dashboard data: \${error.message}
          </div>
        \`;
      }
    }

    // Load on page load
    loadDashboard();
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

/**
 * Handler for GET /api/dashboard/urls
 * Returns all URLs with statistics
 */
export async function handleDashboardData(_storage: any): Promise<Response> {
  // Note: KV doesn't support listing all keys efficiently
  // This is a limitation we'll document
  // For production, consider using Durable Objects or external DB

  return new Response(
    JSON.stringify({
      error: "Not Implemented",
      message: "Cloudflare KV does not support efficient key listing. To enable the dashboard, consider migrating to Durable Objects or using an external database.",
      urls: [],
    }, null, 2),
    {
      status: 501,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
