import os from 'node:os'
import { app } from 'electron'

export interface TelemetryPayload {
  v: 1
  installId: string
  event: 'install' | 'launch'
  appVersion: string
  os: 'win10' | 'win11'
  arch: string
  locale: string
}

export function buildTelemetryPayload({
  installId,
  event,
  appVersion,
  platform = process.platform,
  osRelease = os.release(),
  locale = app.getLocale ? app.getLocale() : 'en',
}: {
  installId: string
  event: 'install' | 'launch'
  appVersion: string
  platform?: string
  osRelease?: string
  locale?: string
}): TelemetryPayload {
  if (!installId || !event || !appVersion) {
    throw new Error('installId, event, and appVersion are required')
  }

  let osTag: 'win10' | 'win11' = 'win10'
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
