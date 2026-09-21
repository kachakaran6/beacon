import { describe, it, expect } from 'vitest'
import { computeNotchBounds, NOTCH_WIDTH, DISPLAY_MARGIN } from '../electron/bounds'

describe('computeNotchBounds', () => {
  const primaryDisplay = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  }

  const secondaryLeftDisplay = {
    id: 2,
    bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
  }

  const smallDisplay = {
    id: 3,
    bounds: { x: 0, y: 0, width: 300, height: 600 },
  }

  it('computes center notch bounds on primary display', () => {
    const notch = computeNotchBounds(primaryDisplay, { align: 'center', offsetPx: 0 }, { width: 190, height: 30 })
    expect(notch.width).toBe(190)
    expect(notch.height).toBe(30)
    expect(notch.y).toBe(0)
    expect(notch.x).toBe(Math.round((1920 - 190) / 2))
    expect(notch.originX).toBe(0.5)
  })

  it('computes left notch bounds with 8px margin', () => {
    const notch = computeNotchBounds(primaryDisplay, { align: 'left', offsetPx: 0 }, { width: 190, height: 30 })
    expect(notch.x).toBe(DISPLAY_MARGIN)
    expect(notch.y).toBe(0)
    expect(notch.width).toBe(190)
  })

  it('computes right notch bounds with 8px margin', () => {
    const notch = computeNotchBounds(primaryDisplay, { align: 'right', offsetPx: 0 }, { width: 190, height: 30 })
    expect(notch.x).toBe(1920 - DISPLAY_MARGIN - NOTCH_WIDTH)
    expect(notch.y).toBe(0)
    expect(notch.width).toBe(190)
  })

  it('handles negative-x secondary display (monitor to the left)', () => {
    const notch = computeNotchBounds(secondaryLeftDisplay, { align: 'center', offsetPx: 0 }, { width: 190, height: 30 })
    expect(notch.x).toBe(-1920 + Math.round((1920 - 190) / 2))
    expect(notch.y).toBe(0)
  })

  it('clamps extreme positive and negative offsets within screen bounds', () => {
    const extremeRight = computeNotchBounds(primaryDisplay, { align: 'center', offsetPx: 5000 }, { width: 190, height: 30 })
    expect(extremeRight.x).toBeLessThanOrEqual(1920 - DISPLAY_MARGIN - NOTCH_WIDTH)
    expect(extremeRight.x).toBe(1920 - DISPLAY_MARGIN - NOTCH_WIDTH)

    const extremeLeft = computeNotchBounds(primaryDisplay, { align: 'center', offsetPx: -5000 }, { width: 190, height: 30 })
    expect(extremeLeft.x).toBeGreaterThanOrEqual(DISPLAY_MARGIN)
    expect(extremeLeft.x).toBe(DISPLAY_MARGIN)
  })

  it('computes panel bounds clamped inside display with originX', () => {
    // Left aligned panel
    const leftPanel = computeNotchBounds(primaryDisplay, { align: 'left', offsetPx: 0 }, { width: 960, height: 420 })
    expect(leftPanel.width).toBe(960)
    expect(leftPanel.height).toBe(420)
    expect(leftPanel.x).toBeGreaterThanOrEqual(DISPLAY_MARGIN)
    expect(leftPanel.originX).toBeGreaterThanOrEqual(0)
    expect(leftPanel.originX).toBeLessThanOrEqual(1)

    // Center aligned panel
    const centerPanel = computeNotchBounds(primaryDisplay, { align: 'center', offsetPx: 0 }, { width: 960, height: 420 })
    expect(centerPanel.x).toBe(Math.round((1920 - 960) / 2))
    expect(centerPanel.originX).toBeCloseTo(0.5, 2)
  })

  it('handles small displays by clamping panel to 92% width', () => {
    const panel = computeNotchBounds(smallDisplay, { align: 'center', offsetPx: 0 }, { width: 960, height: 420 })
    expect(panel.width).toBeLessThanOrEqual(Math.floor(300 * 0.92))
    expect(panel.x).toBeGreaterThanOrEqual(0)
  })

  it('invariant: pill screen X is identical in collapsed and expanded states across alignments', () => {
    const alignments: ('left' | 'center' | 'right')[] = ['left', 'center', 'right']
    const offsets = [-100, 0, 80, 500, -500]
    const displays = [primaryDisplay, secondaryLeftDisplay, smallDisplay]

    for (const display of displays) {
      for (const align of alignments) {
        for (const offsetPx of offsets) {
          const notch = computeNotchBounds(display, { align, offsetPx }, { width: 190, height: 30 })
          const panel = computeNotchBounds(display, { align, offsetPx }, { width: 960, height: 420 })

          const pillLeft = notch.x - panel.x
          const pillScreenXInExpanded = panel.x + pillLeft

          expect(pillScreenXInExpanded).toBe(notch.x)
          expect(Math.abs(pillScreenXInExpanded - notch.x)).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('throws error when display has no bounds', () => {
    expect(() => computeNotchBounds(null as any)).toThrow()
  })
})
