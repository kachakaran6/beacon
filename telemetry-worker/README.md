# Beacon Anonymous Telemetry Worker

A lightweight, privacy-first Cloudflare Worker and D1 backend for tracking anonymous Beacon installs and active usage.

## Architecture

- **Runtime**: Cloudflare Workers (Free Tier)
- **Database**: Cloudflare D1 SQL database
- **Storage**: Coarse telemetry metrics only (`install_id`, `app_version`, `os`, `arch`, coarse `country` from Cloudflare headers).
- **Zero Personal Data**: IP addresses, usernames, task names, note contents, hostnames, and file paths are **never** received or stored.

---

## Deployment Steps

### 1. Prerequisites
Ensure you have Node.js 18+ and the Wrangler CLI installed:
```bash
npm install -g wrangler
# or use npx wrangler
```

Authenticate with Cloudflare:
```bash
npx wrangler login
```

### 2. Create the D1 Database
Create a D1 database named `beacon_telemetry_db`:
```bash
npx wrangler d1 create beacon_telemetry_db
```
Wrangler will output configuration instructions containing your `database_id`. Update `telemetry-worker/wrangler.toml` with this `database_id`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "beacon_telemetry_db"
database_id = "<your-d1-database-id-here>"
```

### 3. Apply the Database Schema
Execute the SQL migration locally and remotely:
```bash
# Execute remotely on Cloudflare D1
npx wrangler d1 execute beacon_telemetry_db --file=./schema.sql --remote
```

### 4. Set the Secret Token for `/stats` & `/dashboard`
Generate a strong secret key for accessing the private metrics endpoint and dashboard:
```bash
npx wrangler secret put STATS_TOKEN
```
Enter your secret token when prompted.

### 5. Deploy the Worker
Deploy the Cloudflare Worker to production:
```bash
npx wrangler deploy
```

Your worker URL will be outputted (e.g. `https://beacon-telemetry.<your-subdomain>.workers.dev`).

### 6. Configure Repository Environment Variable
Set the deployed worker URL as a repository variable in GitHub:
- Navigate to **GitHub Repository > Settings > Secrets and variables > Actions > Variables**
- Add variable: `BEACON_TELEMETRY_URL` with value `https://beacon-telemetry.<your-subdomain>.workers.dev`

When GitHub Actions builds the release, it embeds this URL into the release binary. Dev builds without this variable will disable telemetry automatically.

---

## API Reference

### `POST /v1/ping`
Accepts anonymous pings from Beacon clients.
- **Payload Schema**:
  ```json
  {
    "v": 1,
    "installId": "123e4567-e89b-12d3-a456-426614174000",
    "event": "install" | "launch",
    "appVersion": "1.0.0",
    "os": "win10" | "win11",
    "arch": "x64" | "arm64",
    "locale": "en-US"
  }
  ```
- **Response**: `200 OK` `{ "ok": true }`

### `GET /stats`
Requires authentication header: `Authorization: Bearer <STATS_TOKEN>`.
Returns aggregated statistics:
- Total unique installs
- DAU (Daily Active Users - 24h), WAU (7d), MAU (30d)
- 30-day daily installs time-series
- OS version breakdown (Windows 10 vs Windows 11)
- App version breakdown
- Coarse country breakdown

### `GET /dashboard`
Interactive single-page monitoring dashboard.
- Prompt for `STATS_TOKEN`
- Live SVG charts (installs over time, OS distribution, top countries)
- Token is kept strictly in-memory
