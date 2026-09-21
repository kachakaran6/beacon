import os from 'node:os'
import { app } from 'electron'

function getAppLocale() {
  try {
    if (typeof app !== 'undefined' && typeof app?.getLocale === 'function') {
      return app.getLocale()
    }
  } catch {
    // fallback
  }
  return process.env.LANG || 'en'
}

/**
 * Pure function to build the privacy-first anonymous telemetry payload.
 * NEVER includes tasks, notes, user names, host names, paths, or hardware IDs.
 */
export function buildTelemetryPayload({
  installId,
  event,
  appVersion,
  platform = process.platform,
  osRelease = os.release(),
  locale = getAppLocale(),
}) {
  if (!installId || !event || !appVersion) {
    throw new Error('installId, event, and appVersion are required')
  }

  // Detect Windows 10 vs 11 (Windows 11 build number >= 22000)
  let osTag = 'win10'
  if (platform === 'win32') {
    const buildMatch = osRelease.match(/(\d+)\.(\d+)\.(\d+)/)
    if (buildMatch && parseInt(buildMatch[3], 10) >= 22000) {
      osTag = 'win11'
    } else {
      osTag = 'win10'
    }
  }

  return {
    v: 1,
    installId,
    event,
    appVersion,
    os: osTag,
    arch: process.arch || 'x64',
    locale: String(locale).slice(0, 10),
  }
}

/**
 * Sends anonymous ping to the configured telemetry endpoint if consent is granted.
 */
export async function sendTelemetryPing({
  store,
  event,
  appVersion,
  telemetryUrl = process.env.BEACON_TELEMETRY_URL,
  logger = console.log,
}) {
  if (process.env.BEACON_TELEMETRY === '0' || !telemetryUrl) {
    return false
  }

  const state = store.get('state')
  if (!state || state.telemetryConsent !== true) {
    // No consent given yet
    return false
  }

  const installId = state.telemetryInstallId
  if (!installId) return false

  const now = Date.now()
  const telemetryHistory = store.get('telemetryHistory') || {}

  if (event === 'install' && telemetryHistory.installSent) {
    return false
  }

  if (event === 'launch') {
    const lastLaunch = telemetryHistory.lastLaunchTime || 0
    // Deduplicate: at most once per 24 hours (86400000 ms)
    if (now - lastLaunch < 24 * 60 * 60 * 1000) {
      return false
    }
  }

  const payload = buildTelemetryPayload({
    installId,
    event,
    appVersion,
  })

  // Fire-and-forget with 5s timeout
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${telemetryUrl.replace(/\/$/, '')}/v1/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Beacon/${appVersion}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (response.ok) {
      if (event === 'install') {
        store.set('telemetryHistory', { ...telemetryHistory, installSent: true, lastLaunchTime: now })
      } else {
        store.set('telemetryHistory', { ...telemetryHistory, lastLaunchTime: now })
      }
      logger(`[telemetry] Ping sent successfully (${event})`)
      return true
    }
  } catch (err) {
    logger(`[telemetry] Ping failed (silent): ${String(err)}`)
  }
  return false
}
