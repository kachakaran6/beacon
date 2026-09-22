import { describe, it, expect } from 'vitest'
import {
  computeWindowShapeVertices,
  NOTCH_CORNER_RADIUS,
  PANEL_CORNER_RADIUS,
  NOTCH_WIDTH,
  NOTCH_HEIGHT,
  PANEL_DEFAULT_WIDTH,
  PANEL_DEFAULT_HEIGHT,
} from '../electron/bounds'

describe('Window Corner Shape and DPI Alignment', () => {
  const DPI_SCALES = [1.0, 1.25, 1.5, 1.75]

  it('computes notch polygon vertices matching NOTCH_CORNER_RADIUS at all DPI scales', () => {
    DPI_SCALES.forEach((dpi) => {
      const vertices = computeWindowShapeVertices(
        NOTCH_WIDTH,
        NOTCH_HEIGHT,
        NOTCH_CORNER_RADIUS,
        dpi
      )

      expect(vertices.length).toBeGreaterThan(6)

      const scaledWidth = Math.round(NOTCH_WIDTH * dpi)
      const scaledHeight = Math.round(NOTCH_HEIGHT * dpi)
      const scaledRadius = Math.round(NOTCH_CORNER_RADIUS * dpi)

      // Top edge must be completely flat at y = 0
      expect(vertices[0]).toEqual({ x: 0, y: 0 })
      expect(vertices[1]).toEqual({ x: scaledWidth, y: 0 })

      // Right edge starts vertical before rounding
      expect(vertices[2].x).toBe(scaledWidth)
      expect(vertices[2].y).toBe(scaledHeight - scaledRadius)

      // All vertices must remain strictly within [0..scaledWidth] x [0..scaledHeight]
      vertices.forEach((pt) => {
        expect(pt.x).toBeGreaterThanOrEqual(0)
        expect(pt.x).toBeLessThanOrEqual(scaledWidth)
        expect(pt.y).toBeGreaterThanOrEqual(0)
        expect(pt.y).toBeLessThanOrEqual(scaledHeight)
      })

      // Bottom arc must reach maximum height
      const maxY = Math.max(...vertices.map((v) => v.y))
      expect(maxY).toBe(scaledHeight)
    })
  })

  it('computes panel polygon vertices matching PANEL_CORNER_RADIUS at all DPI scales', () => {
    DPI_SCALES.forEach((dpi) => {
      const vertices = computeWindowShapeVertices(
        PANEL_DEFAULT_WIDTH,
        PANEL_DEFAULT_HEIGHT,
        PANEL_CORNER_RADIUS,
        dpi
      )

      const scaledWidth = Math.round(PANEL_DEFAULT_WIDTH * dpi)
      const scaledHeight = Math.round(PANEL_DEFAULT_HEIGHT * dpi)
      const scaledRadius = Math.round(PANEL_CORNER_RADIUS * dpi)

      expect(vertices[0]).toEqual({ x: 0, y: 0 })
      expect(vertices[1]).toEqual({ x: scaledWidth, y: 0 })
      expect(vertices[2].y).toBe(scaledHeight - scaledRadius)

      vertices.forEach((pt) => {
        expect(pt.x).toBeGreaterThanOrEqual(0)
        expect(pt.x).toBeLessThanOrEqual(scaledWidth)
        expect(pt.y).toBeGreaterThanOrEqual(0)
        expect(pt.y).toBeLessThanOrEqual(scaledHeight)
      })
    })
  })
})
