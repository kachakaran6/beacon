# Privacy Policy for Beacon

**Last updated: September 2026**

Beacon ("we", "us", or "our") is designed from the ground up to respect your privacy. This document outlines our data handling practices in clear, plain language.

---

## 1. Local-First Data Storage

- **Your Content Stays On Your Computer**: All of your tasks, task descriptions, subtasks, notes, estimates, focus history, and configuration preferences are saved locally on your computer in `%APPDATA%\Beacon\store.json`.
- **No Account Required**: You do not need to create an account, log in, or provide an email address to use Beacon.
- **No Cloud Synchronization**: Beacon does not upload your tasks, notes, or focus history to any remote server or cloud database.

---

## 2. Anonymous Usage Statistics (Telemetry)

Beacon includes an optional, privacy-first anonymous telemetry system to help maintainers understand general adoption and operating system compatibility.

### Telemetry Principles
- **Explicit Consent**: Telemetry is disabled by default until you make a choice via the initial consent prompt or in Settings.
- **Strictly Anonymous**: We do not collect names, emails, IP addresses, computer hostnames, file paths, hardware serial numbers, or task/note contents.
- **Minimal Payload**: The only data transmitted is:
  - `v`: Schema version number (e.g. `1`)
  - `installId`: A randomly generated UUID (e.g. `e0a3f9e2-...`)
  - `event`: Either `"install"` (sent once on initial setup) or `"launch"` (sent at most once per 24-hour period)
  - `appVersion`: The version of Beacon currently installed (e.g. `1.0.0`)
  - `os`: Coarse Windows version (`win10` or `win11`)
  - `arch`: System architecture (`x64` or `arm64`)
  - `locale`: Language locale code (e.g. `en-US`)

### Full Control & Transparency
- You can inspect the exact JSON payload sent by opening **Settings &rarr; Privacy &rarr; Show exactly what is sent**.
- You can reset your random installation ID at any time with one click.
- You can toggle telemetry off completely at any time under **Settings &rarr; Privacy**.

---

## 3. Auto-Updates

When configured to check for updates, Beacon makes a read-only request to GitHub's public API to query the latest release metadata. No personal data is transmitted during update checks.

---

## 4. Contact

If you have any questions or security concerns regarding our privacy practices, please file an issue or contact the maintainers at [https://github.com/kachakaran6/beacon/issues](https://github.com/kachakaran6/beacon/issues).
