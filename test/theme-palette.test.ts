import { describe, it, expect } from 'vitest'
import {
  COLOR_THEMES,
  PRIMARY_THEME_IDS,
  getTheme,
  buildSystemTheme,
  rgbToHsl,
} from '../src/themes'

describe('Curated Professional Color Themes', () => {
  it('ensures all curated themes have saturation capped <= 55% for calm aesthetics', () => {
    PRIMARY_THEME_IDS.forEach((id) => {
      const theme = COLOR_THEMES[id]
      expect(theme).toBeDefined()

      // Parse hex color to RGB
      const hex = theme.dotLit.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)

      const [_h, s, l] = rgbToHsl(r, g, b)

      // Saturation must be <= 55% (no neon or gaming colors)
      expect(s).toBeLessThanOrEqual(55)
      // Lightness must provide strong contrast against near-black background
      expect(l).toBeGreaterThanOrEqual(50)
      expect(l).toBeLessThanOrEqual(95)
    })
  })

  it('guarantees unique, distinct hues across non-monochromatic chromatic themes', () => {
    const chromaticThemes = ['amber', 'glacier', 'sage', 'rosewood'] as const
    const hues: number[] = []

    chromaticThemes.forEach((id) => {
      const theme = COLOR_THEMES[id]
      const hex = theme.dotLit.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      const [h] = rgbToHsl(r, g, b)
      hues.push(h)
    })

    // Verify all chromatic hues are well-spaced across color wheel
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = Math.min(Math.abs(hues[i] - hues[j]), 360 - Math.abs(hues[i] - hues[j]))
        // Distinguishable color families
        expect(diff).toBeGreaterThan(25)
      }
    }
  })

  it('seamlessly migrates legacy theme IDs to new professional palettes', () => {
    expect(getTheme('classic' as any).id).toBe('mono')
    expect(getTheme('ice' as any).id).toBe('glacier')
    expect(getTheme('forest' as any).id).toBe('sage')
    expect(getTheme('sunset' as any).id).toBe('rosewood')
    expect(getTheme('violet' as any).id).toBe('rosewood')
    expect(getTheme('mono').id).toBe('mono')
    expect(getTheme('warm-white').id).toBe('warm-white')
  })

  it('clamps Windows system accent saturation and lightness in buildSystemTheme', () => {
    // Highly saturated neon blue input
    const neonBlue = '#0066FF'
    const systemTheme = buildSystemTheme(neonBlue)

    const hex = systemTheme.dotLit.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const [_h, s, l] = rgbToHsl(r, g, b)

    expect(s).toBeLessThanOrEqual(55)
    expect(l).toBeGreaterThanOrEqual(60)
  })
})
