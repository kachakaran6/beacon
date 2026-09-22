export type ThemeId = 'classic' | 'amber' | 'ice' | 'forest' | 'sunset' | 'violet' | 'system'

export interface ColorTheme {
  id: ThemeId
  name: string
  background: string
  dotLit: string
  dotUnlit: string
  accent: string
  glow: string
}

export const COLOR_THEMES: Record<Exclude<ThemeId, 'system'>, ColorTheme> = {
  classic: {
    id: 'classic',
    name: 'Classic Mono',
    background: '#000000',
    dotLit: '#FFFFFF',
    dotUnlit: 'rgba(255, 255, 255, 0.08)',
    accent: '#FFFFFF',
    glow: 'rgba(255, 255, 255, 0.35)',
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    background: '#120A00',
    dotLit: '#FF9E1B',
    dotUnlit: 'rgba(255, 158, 27, 0.10)',
    accent: '#FF9E1B',
    glow: 'rgba(255, 158, 27, 0.40)',
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    background: '#041018',
    dotLit: '#38BDF8',
    dotUnlit: 'rgba(56, 189, 248, 0.10)',
    accent: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.40)',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    background: '#06150B',
    dotLit: '#4ADE80',
    dotUnlit: 'rgba(74, 222, 128, 0.10)',
    accent: '#4ADE80',
    glow: 'rgba(74, 222, 128, 0.40)',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    background: '#170A08',
    dotLit: '#FF7A59',
    dotUnlit: 'rgba(255, 122, 89, 0.10)',
    accent: '#FF7A59',
    glow: 'rgba(255, 122, 89, 0.40)',
  },
  violet: {
    id: 'violet',
    name: 'Violet',
    background: '#12091D',
    dotLit: '#C084FC',
    dotUnlit: 'rgba(192, 132, 252, 0.10)',
    accent: '#C084FC',
    glow: 'rgba(192, 132, 252, 0.40)',
  },
}

export const THEME_LIST: ThemeId[] = [
  'classic',
  'amber',
  'ice',
  'forest',
  'sunset',
  'violet',
  'system',
]

/**
 * Parses a hex color or RGBA string and clamps luminance for optimal readability on dark backgrounds.
 */
export function buildSystemTheme(rawAccentHex?: string | null): ColorTheme {
  const fallback = COLOR_THEMES.classic
  if (!rawAccentHex) {
    return {
      ...fallback,
      id: 'system',
      name: 'System',
    }
  }

  // Sanitize hex string (handles 6-char, 8-char RRGGBBAA or AARRGGBB)
  let clean = rawAccentHex.replace(/^#/, '').trim()
  if (clean.length === 8) {
    clean = clean.slice(0, 6)
  }
  if (clean.length !== 6) {
    return { ...fallback, id: 'system', name: 'System' }
  }

  let r = parseInt(clean.substring(0, 2), 16)
  let g = parseInt(clean.substring(2, 4), 16)
  let b = parseInt(clean.substring(4, 6), 16)

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return { ...fallback, id: 'system', name: 'System' }
  }

  // Calculate relative luminance (sRGB)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Boost contrast if color is too dark for lit dots on dark backdrop
  if (lum < 0.45) {
    const boost = 0.45 / Math.max(0.1, lum)
    r = Math.min(255, Math.round(r * boost + (255 - r) * 0.2))
    g = Math.min(255, Math.round(g * boost + (255 - g) * 0.2))
    b = Math.min(255, Math.round(b * boost + (255 - b) * 0.2))
  }

  const litHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`

  // Dark background with subtle hue
  const bgR = Math.round(r * 0.06)
  const bgG = Math.round(g * 0.06)
  const bgB = Math.round(b * 0.08)
  const bgHex = `#${((1 << 24) + (bgR << 16) + (bgG << 8) + bgB).toString(16).slice(1)}`

  return {
    id: 'system',
    name: 'System',
    background: bgHex,
    dotLit: litHex,
    dotUnlit: `rgba(${r}, ${g}, ${b}, 0.12)`,
    accent: litHex,
    glow: `rgba(${r}, ${g}, ${b}, 0.40)`,
  }
}

export function getTheme(themeId: ThemeId = 'classic', systemAccentHex?: string | null): ColorTheme {
  if (themeId === 'system') {
    return buildSystemTheme(systemAccentHex)
  }
  return COLOR_THEMES[themeId] ?? COLOR_THEMES.classic
}
