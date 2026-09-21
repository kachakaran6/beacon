import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildTelemetryPayload, sendTelemetryPing } from '../electron/telemetry'
import { validatePingPayload } from '../telemetry-worker/src/index.js'

describe('Telemetry Payload Builder', () => {
  it('builds strict anonymous payload with required fields only', () => {
    const payload = buildTelemetryPayload({
      installId: '123e4567-e89b-12d3-a456-426614174000',
      event: 'launch',
      appVersion: '1.0.0',
      platform: 'win32',
      osRelease: '10.0.22631',
      locale: 'en-US',
    })

    expect(payload).toEqual({
      v: 1,
      installId: '123e4567-e89b-12d3-a456-426614174000',
      event: 'launch',
      appVersion: '1.0.0',
      os: 'win11',
      arch: expect.any(String),
      locale: 'en-US',
    })

    // Strict schema check: keys must match exactly
    const allowedKeys = new Set(['v', 'installId', 'event', 'appVersion', 'os', 'arch', 'locale'])
    for (const key of Object.keys(payload)) {
      expect(allowedKeys.has(key)).toBe(true)
    }
  })

  it('guarantees no personal or task data is included in payload', () => {
    const payload = buildTelemetryPayload({
      installId: 'anon-id',
      event: 'install',
      appVersion: '1.0.0',
    }) as any

    expect(payload.task).toBeUndefined()
    expect(payload.tasks).toBeUndefined()
    expect(payload.note).toBeUndefined()
    expect(payload.notes).toBeUndefined()
    expect(payload.title).toBeUndefined()
    expect(payload.username).toBeUndefined()
    expect(payload.hostname).toBeUndefined()
    expect(payload.path).toBeUndefined()
    expect(payload.ip).toBeUndefined()
    expect(payload.hardwareId).toBeUndefined()
  })

  it('identifies Windows 10 vs Windows 11 by build number', () => {
    const win10 = buildTelemetryPayload({
      installId: 'anon-10',
      event: 'launch',
      appVersion: '1.0.0',
      platform: 'win32',
      osRelease: '10.0.19045',
    })
    expect(win10.os).toBe('win10')

    const win11 = buildTelemetryPayload({
      installId: 'anon-11',
      event: 'launch',
      appVersion: '1.0.0',
      platform: 'win32',
      osRelease: '10.0.22621',
    })
    expect(win11.os).toBe('win11')
  })

  it('throws when required fields are missing', () => {
    expect(() => buildTelemetryPayload({ installId: '', event: 'launch', appVersion: '1.0.0' })).toThrow()
    expect(() => buildTelemetryPayload({ installId: '1', event: '' as any, appVersion: '1.0.0' })).toThrow()
  })
})

describe('sendTelemetryPing', () => {
  let mockStoreData: Record<string, any>
  let mockStore: {
    get: (key: string) => any
    set: (key: string, val: any) => void
  }

  beforeEach(() => {
    mockStoreData = {
      state: {
        telemetryConsent: true,
        telemetryInstallId: '123e4567-e89b-12d3-a456-426614174000',
      },
      telemetryHistory: {},
    }
    mockStore = {
      get: (key: string) => mockStoreData[key],
      set: (key: string, val: any) => {
        mockStoreData[key] = val
      },
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
  })

  it('sends nothing when BEACON_TELEMETRY_URL is missing', async () => {
    const result = await sendTelemetryPing({
      store: mockStore as any,
      event: 'launch',
      appVersion: '1.0.0',
      telemetryUrl: '',
    })
    expect(result).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends nothing when user consent has not been granted', async () => {
    mockStoreData.state.telemetryConsent = false
    const result = await sendTelemetryPing({
      store: mockStore as any,
      event: 'launch',
      appVersion: '1.0.0',
      telemetryUrl: 'https://telemetry.example.com',
    })
    expect(result).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends ping when consent is granted and updates history', async () => {
    const result = await sendTelemetryPing({
      store: mockStore as any,
      event: 'launch',
      appVersion: '1.0.0',
      telemetryUrl: 'https://telemetry.example.com',
    })
    expect(result).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(mockStoreData.telemetryHistory.lastLaunchTime).toBeGreaterThan(0)
  })

  it('deduplicates 24h launch events', async () => {
    mockStoreData.telemetryHistory = {
      lastLaunchTime: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
    }
    const result = await sendTelemetryPing({
      store: mockStore as any,
      event: 'launch',
      appVersion: '1.0.0',
      telemetryUrl: 'https://telemetry.example.com',
    })
    expect(result).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('deduplicates install events once sent', async () => {
    mockStoreData.telemetryHistory = {
      installSent: true,
    }
    const result = await sendTelemetryPing({
      store: mockStore as any,
      event: 'install',
      appVersion: '1.0.0',
      telemetryUrl: 'https://telemetry.example.com',
    })
    expect(result).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('Worker validatePingPayload', () => {
  it('accepts valid ping payload', () => {
    const valid = validatePingPayload({
      v: 1,
      installId: '123e4567-e89b-12d3-a456-426614174000',
      event: 'launch',
      appVersion: '1.0.0',
      os: 'win11',
      arch: 'x64',
      locale: 'en-US',
    })
    expect(valid.valid).toBe(true)
    expect(valid.data?.installId).toBe('123e4567-e89b-12d3-a456-426614174000')
  })

  it('rejects invalid UUID installId', () => {
    const invalid = validatePingPayload({
      v: 1,
      installId: 'not-a-uuid',
      event: 'launch',
      appVersion: '1.0.0',
      os: 'win11',
      arch: 'x64',
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.error).toContain('UUID')
  })

  it('rejects unsupported event or OS', () => {
    const badEvent = validatePingPayload({
      v: 1,
      installId: '123e4567-e89b-12d3-a456-426614174000',
      event: 'click_button',
      appVersion: '1.0.0',
      os: 'win11',
      arch: 'x64',
    })
    expect(badEvent.valid).toBe(false)

    const badOs = validatePingPayload({
      v: 1,
      installId: '123e4567-e89b-12d3-a456-426614174000',
      event: 'launch',
      appVersion: '1.0.0',
      os: 'linux',
      arch: 'x64',
    })
    expect(badOs.valid).toBe(false)
  })
})
