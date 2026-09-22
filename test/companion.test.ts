import { describe, it, expect } from 'vitest'
import {
  BLINK_MAX_INTERVAL_MS,
  BLINK_MIN_INTERVAL_MS,
  calculateCursorOffset,
  EYE_PATTERNS,
  getNextBlinkDelay,
  MAX_CURSOR_OFFSET_PX,
} from '../src/companion-logic'

describe('Companion Eyes Character Logic', () => {
  it('validates eye matrix patterns for all states', () => {
    for (const [state, rows] of Object.entries(EYE_PATTERNS)) {
      expect(rows).toHaveLength(4)
      for (const row of rows) {
        expect(row).toHaveLength(4)
        expect(/^[01]+$/.test(row)).toBe(true)
      }
    }
  })

  it('generates randomized blink delays strictly within [3000, 6000] ms bounds over 60 iterations', () => {
    for (let i = 0; i < 60; i++) {
      const delay = getNextBlinkDelay()
      expect(delay).toBeGreaterThanOrEqual(BLINK_MIN_INTERVAL_MS)
      expect(delay).toBeLessThanOrEqual(BLINK_MAX_INTERVAL_MS)
    }
  })

  it('calculates clamped cursor tracking offset and respects proximity', () => {
    const notchCenter = 500

    // Center point -> 0 offset
    expect(calculateCursorOffset(500, notchCenter, 200)).toBe(0)

    // Move right by 100px -> positive clamped offset
    const offsetRight = calculateCursorOffset(600, notchCenter, 200)
    expect(offsetRight).toBeGreaterThan(0)
    expect(offsetRight).toBeLessThanOrEqual(MAX_CURSOR_OFFSET_PX)

    // Move far right (> proximity 200) -> 0 (ignores out of bounds)
    expect(calculateCursorOffset(800, notchCenter, 200)).toBe(0)

    // Move left by 100px -> negative clamped offset
    const offsetLeft = calculateCursorOffset(400, notchCenter, 200)
    expect(offsetLeft).toBeLessThan(0)
    expect(offsetLeft).toBeGreaterThanOrEqual(-MAX_CURSOR_OFFSET_PX)

    // Maximum clamp test
    const extremeRight = calculateCursorOffset(699, notchCenter, 200)
    expect(extremeRight).toBeLessThanOrEqual(MAX_CURSOR_OFFSET_PX)
  })
})
