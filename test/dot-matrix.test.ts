import { describe, it, expect } from 'vitest'
import { computeDotGrid, FONT_5X7, FONT_7X11 } from '../src/components/DotMatrix'

describe('DotMatrix HD Pixel Grid & Typography', () => {
  it('contains valid 5x7 glyph definitions with 7 rows of 5 dots', () => {
    for (const [char, rows] of Object.entries(FONT_5X7)) {
      expect(rows).toHaveLength(7)
      for (const row of rows) {
        expect(row).toHaveLength(5)
        expect(/^[01]+$/.test(row)).toBe(true)
      }
    }
  })

  it('contains valid 7x11 glyph definitions with 11 rows of 7 dots', () => {
    for (const [char, rows] of Object.entries(FONT_7X11)) {
      expect(rows).toHaveLength(11)
      for (const row of rows) {
        expect(row).toHaveLength(7)
        expect(/^[01]+$/.test(row)).toBe(true)
      }
    }
  })

  it('computes integer-snapped viewBox and dot coordinates for 5x7 in-notch text', () => {
    const res = computeDotGrid('12:00', '5x7', 1.0)
    expect(res.width).toBeGreaterThan(0)
    expect(res.height).toBe(20) // 7 rows * 3 - 1 = 20
    expect(res.viewBox).toBe(`0 0 ${res.width} 20`)

    for (const dot of res.dots) {
      // cx and cy should be integers or exact half-integers (.0 or .5), no float drift
      expect(dot.cx % 0.5).toBe(0)
      expect(dot.cy % 0.5).toBe(0)
      expect(dot.r).toBe(1)
    }
  })

  it('computes 7x11 timer grid with smooth higher-resolution curves', () => {
    const res = computeDotGrid('25:00', '7x11', 1.0)
    expect(res.height).toBe(64) // 11 rows * 6 - 2 = 64
    expect(res.dots.length).toBe(5 * 7 * 11) // 5 chars * 77 dots = 385 dots
    for (const dot of res.dots) {
      expect(dot.cx % 0.5).toBe(0)
      expect(dot.cy % 0.5).toBe(0)
      expect(dot.r).toBe(2)
    }
  })

  it('maintains integer pixel grid alignment across 100%, 125%, 150%, 175% scaling', () => {
    const scales = [1.0, 1.25, 1.5, 1.75]
    for (const scale of scales) {
      const res5x7 = computeDotGrid('10:45', '5x7', scale)
      const res7x11 = computeDotGrid('10:45', '7x11', scale)

      expect(Number.isInteger(res5x7.width)).toBe(true)
      expect(Number.isInteger(res5x7.height)).toBe(true)
      expect(Number.isInteger(res7x11.width)).toBe(true)
      expect(Number.isInteger(res7x11.height)).toBe(true)

      // Verify no NaN or sub-subpixel fractional jitter
      for (const dot of [...res5x7.dots, ...res7x11.dots]) {
        expect(Number.isFinite(dot.cx)).toBe(true)
        expect(Number.isFinite(dot.cy)).toBe(true)
        expect(dot.cx % 0.5).toBe(0)
        expect(dot.cy % 0.5).toBe(0)
      }
    }
  })

  it('handles custom and missing glyphs gracefully without error', () => {
    const res = computeDotGrid('TEST 123!', '5x7', 1.0)
    expect(res.dots.length).toBe(9 * 5 * 7)
  })
})
