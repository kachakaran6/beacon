import { describe, it, expect } from 'vitest'
import {
  BLINK_MAX_INTERVAL_MS,
  BLINK_MIN_INTERVAL_MS,
  calculateCursorTrackingOffset,
  DIRECTION_OFFSETS,
  getNextBlinkInterval,
  getNextHoldInterval,
  getNextRestInterval,
  getRandomGlanceDirection,
  GlanceDirection,
  HAPPY_SQUINT_PATTERN,
  HOLD_MAX_INTERVAL_MS,
  HOLD_MIN_INTERVAL_MS,
  MAX_PUPIL_OFFSET_X,
  MAX_PUPIL_OFFSET_Y,
  PUPIL_PATTERN,
  REST_MAX_INTERVAL_MS,
  REST_MIN_INTERVAL_MS,
  SCLERA_FRAME_PATTERN,
} from '../src/companion-logic'

describe('Companion Eyes Mascot Anatomy & Motion Logic', () => {
  it('validates eye matrix patterns for sclera frame, pupil, and happy celebration', () => {
    // Sclera frame is 5 rows of 6 cols
    expect(SCLERA_FRAME_PATTERN).toHaveLength(5)
    SCLERA_FRAME_PATTERN.forEach((row) => {
      expect(row).toHaveLength(6)
      expect(/^[01]+$/.test(row)).toBe(true)
    })

    // Pupil is 2 rows of 2 cols
    expect(PUPIL_PATTERN).toHaveLength(2)
    PUPIL_PATTERN.forEach((row) => {
      expect(row).toHaveLength(2)
      expect(row).toBe('11')
    })

    // Happy squint is 5 rows of 6 cols
    expect(HAPPY_SQUINT_PATTERN).toHaveLength(5)
    HAPPY_SQUINT_PATTERN.forEach((row) => {
      expect(row).toHaveLength(6)
      expect(/^[01]+$/.test(row)).toBe(true)
    })
  })

  it('generates randomized intervals strictly within defined bounds over 60 iterations', () => {
    for (let i = 0; i < 60; i++) {
      const blink = getNextBlinkInterval()
      expect(blink).toBeGreaterThanOrEqual(BLINK_MIN_INTERVAL_MS)
      expect(blink).toBeLessThanOrEqual(BLINK_MAX_INTERVAL_MS)

      const rest = getNextRestInterval()
      expect(rest).toBeGreaterThanOrEqual(REST_MIN_INTERVAL_MS)
      expect(rest).toBeLessThanOrEqual(REST_MAX_INTERVAL_MS)

      const hold = getNextHoldInterval()
      expect(hold).toBeGreaterThanOrEqual(HOLD_MIN_INTERVAL_MS)
      expect(hold).toBeLessThanOrEqual(HOLD_MAX_INTERVAL_MS)
    }
  })

  it('picks valid 8-direction glances with distinct offsets within pupil boundaries', () => {
    const validDirections: GlanceDirection[] = [
      'left',
      'right',
      'up',
      'down',
      'up_left',
      'up_right',
      'down_left',
      'down_right',
    ]

    for (let i = 0; i < 40; i++) {
      const dir = getRandomGlanceDirection()
      expect(validDirections).toContain(dir)

      const offset = DIRECTION_OFFSETS[dir]
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(MAX_PUPIL_OFFSET_X)
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(MAX_PUPIL_OFFSET_Y)
    }
  })

  it('calculates clamped 2D cursor tracking offsets within 150px radius and resets outside', () => {
    const notchCenterX = 500
    const notchCenterY = 15

    // Exact center -> active, 0 offset
    const centerRes = calculateCursorTrackingOffset(500, 15, notchCenterX, notchCenterY, 150)
    expect(centerRes.active).toBe(false) // distance 0 is inactive/centered

    // Move cursor right by 75px, down by 40px (distance ~85px <= 150px)
    const nearRes = calculateCursorTrackingOffset(575, 55, notchCenterX, notchCenterY, 150)
    expect(nearRes.active).toBe(true)
    expect(nearRes.offset.x).toBeGreaterThan(0)
    expect(nearRes.offset.y).toBeGreaterThan(0)
    expect(nearRes.offset.x).toBeLessThanOrEqual(MAX_PUPIL_OFFSET_X)
    expect(nearRes.offset.y).toBeLessThanOrEqual(MAX_PUPIL_OFFSET_Y)

    // Move cursor far away (> 150px radius)
    const farRes = calculateCursorTrackingOffset(800, 300, notchCenterX, notchCenterY, 150)
    expect(farRes.active).toBe(false)
    expect(farRes.offset).toEqual({ x: 0, y: 0 })

    // Move cursor left by 100px, up by 10px
    const leftRes = calculateCursorTrackingOffset(400, 5, notchCenterX, notchCenterY, 150)
    expect(leftRes.active).toBe(true)
    expect(leftRes.offset.x).toBeLessThan(0)
    expect(leftRes.offset.y).toBeLessThan(0)
  })
})
