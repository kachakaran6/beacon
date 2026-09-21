/**
 * Beacon Anonymous Telemetry Cloudflare Worker
 * Privacy-first usage analytics with D1 database storage
 */

export function validatePingPayload(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid JSON payload' }
  }

  const { v, installId, event, appVersion, os, arch, locale } = body

  if (v !== 1) {
    return { valid: false, error: 'Unsupported payload version' }
  }

  // UUID format check (standard or v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!installId || typeof installId !== 'string' || !uuidRegex.test(installId)) {
    return { valid: false, error: 'Invalid installId format (must be UUID)' }
  }

  if (event !== 'install' && event !== 'launch') {
    return { valid: false, error: 'Invalid event type (must be "install" or "launch")' }
  }

  if (!appVersion || typeof appVersion !== 'string' || appVersion.length > 20) {
    return { valid: false, error: 'Invalid appVersion' }
  }

  if (os !== 'win10' && os !== 'win11') {
    return { valid: false, error: 'Invalid os type' }
  }

  if (!arch || typeof arch !== 'string' || arch.length > 10) {
    return { valid: false, error: 'Invalid arch' }
  }

  if (locale && (typeof locale !== 'string' || locale.length > 15)) {
    return { valid: false, error: 'Invalid locale' }
  }

  return { valid: true, data: { v, installId, event, appVersion, os, arch, locale } }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const method = request.method

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // ─── POST /v1/ping ────────────────────────────────────────────────────────
    if (url.pathname === '/v1/ping' && method === 'POST') {
      const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
      if (contentLength > 1024) {
        return new Response(JSON.stringify({ error: 'Payload too large (max 1KB)' }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let body
      try {
        body = await request.json()
      } catch {
        return new Response(JSON.stringify({ error: 'Malformed JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const validation = validatePingPayload(body)
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { installId, appVersion, os, arch } = validation.data
      const country = request.cf?.country || 'Unknown'
      const nowIso = new Date().toISOString()
      const today = nowIso.slice(0, 10)

      if (env.DB) {
        try {
          // 1. Upsert into installs table
          await env.DB.prepare(
            `INSERT INTO installs (install_id, first_seen, last_seen, app_version, os, arch, country)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(install_id) DO UPDATE SET
               last_seen = excluded.last_seen,
               app_version = excluded.app_version,
               country = excluded.country`
          )
            .bind(installId, nowIso, nowIso, appVersion, os, arch, country)
            .run()

          // 2. Record daily active
          await env.DB.prepare(
            `INSERT OR IGNORE INTO daily_active (day, install_id) VALUES (?, ?)`
          )
            .bind(today, installId)
            .run()
        } catch {
          return new Response(JSON.stringify({ error: 'Database write error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── GET /stats ───────────────────────────────────────────────────────────
    if (url.pathname === '/stats' && method === 'GET') {
      const authHeader = request.headers.get('Authorization') || ''
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()

      if (!env.STATS_TOKEN || token !== env.STATS_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      try {
        const today = new Date().toISOString().slice(0, 10)
        const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
        const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

        // Total Installs
        const totalInstallsRow = await env.DB.prepare(`SELECT COUNT(*) as count FROM installs`).first()
        const totalInstalls = totalInstallsRow?.count || 0

        // DAU
        const dauRow = await env.DB.prepare(`SELECT COUNT(DISTINCT install_id) as count FROM daily_active WHERE day = ?`).bind(today).first()
        const dau = dauRow?.count || 0

        // WAU
        const wauRow = await env.DB.prepare(`SELECT COUNT(DISTINCT install_id) as count FROM daily_active WHERE day >= ?`).bind(d7).first()
        const wau = wauRow?.count || 0

        // MAU
        const mauRow = await env.DB.prepare(`SELECT COUNT(DISTINCT install_id) as count FROM daily_active WHERE day >= ?`).bind(d30).first()
        const mau = mauRow?.count || 0

        // New installs per day (last 30 days)
        const { results: installsPerDay } = await env.DB.prepare(
          `SELECT SUBSTR(first_seen, 1, 10) as day, COUNT(*) as count
           FROM installs
           WHERE first_seen >= ?
           GROUP BY day
           ORDER BY day ASC`
        ).bind(d30).all()

        // OS Breakdown
        const { results: osBreakdown } = await env.DB.prepare(
          `SELECT os, COUNT(*) as count FROM installs GROUP BY os`
        ).all()

        // Version Breakdown
        const { results: versionBreakdown } = await env.DB.prepare(
          `SELECT app_version, COUNT(*) as count FROM installs GROUP BY app_version`
        ).all()

        // Top Countries
        const { results: topCountries } = await env.DB.prepare(
          `SELECT country, COUNT(*) as count FROM installs GROUP BY country ORDER BY count DESC LIMIT 10`
        ).all()

        return new Response(
          JSON.stringify({
            totalInstalls,
            dau,
            wau,
            mau,
            installsPerDay: installsPerDay || [],
            osBreakdown: osBreakdown || [],
            versionBreakdown: versionBreakdown || [],
            topCountries: topCountries || [],
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Query failed', details: String(err) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ─── GET /dashboard ───────────────────────────────────────────────────────
    if (url.pathname === '/dashboard' && method === 'GET') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Beacon Telemetry Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0A; color: #EEE; margin: 0; padding: 24px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 600; color: #FFF; margin-bottom: 20px; }
    .auth-box { background: #181818; padding: 16px; border-radius: 12px; margin-bottom: 24px; display: flex; gap: 8px; }
    input { background: #262626; border: 1px solid #333; color: #FFF; padding: 8px 12px; border-radius: 6px; flex: 1; font-size: 13px; }
    button { background: #FFF; color: #111; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .metric { background: #181818; border-radius: 12px; padding: 16px; }
    .metric-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; }
    .metric-val { font-size: 28px; font-weight: 700; color: #FFF; margin-top: 4px; }
    .chart-box { background: #181818; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #282828; }
    th { color: #888; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Beacon Analytics Dashboard</h1>
    <div class="auth-box">
      <input type="password" id="token" placeholder="Enter STATS_TOKEN">
      <button onclick="loadStats()">View Stats</button>
    </div>
    <div id="content" style="display:none;">
      <div class="grid">
        <div class="metric"><div class="metric-label">Total Installs</div><div class="metric-val" id="m-installs">-</div></div>
        <div class="metric"><div class="metric-label">DAU (Today)</div><div class="metric-val" id="m-dau">-</div></div>
        <div class="metric"><div class="metric-label">WAU (7 Days)</div><div class="metric-val" id="m-wau">-</div></div>
        <div class="metric"><div class="metric-label">MAU (30 Days)</div><div class="metric-val" id="m-mau">-</div></div>
      </div>
      <div class="chart-box">
        <div style="font-weight:600; margin-bottom:12px;">Top Countries</div>
        <table id="t-countries"></table>
      </div>
    </div>
  </div>
  <script>
    async function loadStats() {
      const token = document.getElementById('token').value.trim();
      if (!token) return;
      try {
        const res = await fetch('/stats', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { alert('Unauthorized or query error'); return; }
        const data = await res.json();
        document.getElementById('m-installs').innerText = data.totalInstalls;
        document.getElementById('m-dau').innerText = data.dau;
        document.getElementById('m-wau').innerText = data.wau;
        document.getElementById('m-mau').innerText = data.mau;
        const countryHtml = '<tr><th>Country</th><th>Installs</th></tr>' + data.topCountries.map(c => '<tr><td>' + c.country + '</td><td>' + c.count + '</td></tr>').join('');
        document.getElementById('t-countries').innerHTML = countryHtml;
        document.getElementById('content').style.display = 'block';
      } catch (err) {
        alert('Fetch error');
      }
    }
  </script>
</body>
</html>`
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}
