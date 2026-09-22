export type ThemeId =
  | 'mono'
  | 'warm-white'
  | 'amber'
  | 'glacier'
  | 'sage'
  | 'rosewood'
  | 'system'
  // Legacy theme IDs for backward compatibility
  | 'classic'
  | 'ice'
  | 'forest'
  | 'sunset'
  | 'violet'

export interface ColorTheme {
  id: ThemeId
  name: string
  background: string
  dotLit: string
  dotUnlit: string
  accent: string
  glow: string
}

export const PRIMARY_THEME_IDS = [
  'mono',
  'warm-white',
  'amber',
  'glacier',
  'sage',
  'rosewood',
] as const

export const THEME_LIST: ThemeId[] = [
  'mono',
  'warm-white',
  'amber',
  'glacier',
  'sage',
  'rosewood',
  'system',
]

export const COLOR_THEMES: Record<
  (typeof PRIMARY_THEME_IDS)[number],
  ColorTheme
> = {
  mono: {
    id: 'mono',
    name: 'Mono',
    background: '#0A0A0C',
    dotLit: '#E8E8E8',
    dotUnlit: 'rgba(232, 232, 232, 0.06)',
    accent: '#E8E8E8',
    glow: 'rgba(232, 232, 232, 0.08)',
  },
  'warm-white': {
    id: 'warm-white',
    name: 'Warm White',
    background: '#0D0C0A',
    dotLit: '#EFE6D8',
    dotUnlit: 'rgba(239, 230, 216, 0.06)',
    accent: '#EFE6D8',
    glow: 'rgba(239, 230, 216, 0.08)',
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    background: '#0F0C08',
    dotLit: '#C89248',
    dotUnlit: 'rgba(200, 146, 72, 0.07)',
    accent: '#C89248',
    glow: 'rgba(200, 146, 72, 0.08)',
  },
  glacier: {
    id: 'glacier',
    name: 'Glacier',
    background: '#090C0E',
    dotLit: '#8DA6B8',
    dotUnlit: 'rgba(141, 166, 184, 0.07)',
    accent: '#8DA6B8',
    glow: 'rgba(141, 166, 184, 0.08)',
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    background: '#090D0A',
    dotLit: '#8FA892',
    dotUnlit: 'rgba(143, 168, 146, 0.07)',
    accent: '#8FA892',
    glow: 'rgba(143, 168, 146, 0.08)',
  },
  rosewood: {
    id: 'rosewood',
    name: 'Rosewood',
    background: '#0F0A0A',
    dotLit: '#BA8080',
    dotUnlit: 'rgba(186, 128, 128, 0.07)',
    accent: '#BA8080',
    glow: 'rgba(186, 128, 128, 0.08)',
  },
}

/** Legacy ID to current theme mapping */
const LEGACY_MAP: Record<string, (typeof PRIMARY_THEME_IDS)[number]> = {
  classic: 'mono',
  ice: 'glacier',
  forest: 'sage',
  sunset: 'rosewood',
  violet: 'rosewood',
}

/**
 * Converts RGB to HSL.
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      case bNorm:
        h = (rNorm - gNorm) / d + 4
        break
    }
    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/**
 * Converts HSL to Hex color string.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360
  const sNorm = s / 100
  const lNorm = l / 100

  let r: number, g: number, b: number

  if (sNorm === 0) {
    r = g = b = lNorm
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tNorm = t
      if (tNorm < 0) tNorm += 1
      if (tNorm > 1) tNorm -= 1
      if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm
      if (tNorm < 1 / 2) return q
      if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6
      return p
    }

    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm
    const p = 2 * lNorm - q
    r = hue2rgb(p, q, hNorm + 1 / 3)
    g = hue2rgb(p, q, hNorm)
    b = hue2rgb(p, q, hNorm - 1 / 3)
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Parses a hex color or RGBA string and builds a refined, desaturated system theme.
 */
export function buildSystemTheme(rawAccentHex?: string | null): ColorTheme {
  const fallback = COLOR_THEMES.mono
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

  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return { ...fallback, id: 'system', name: 'System' }
  }

  const [h, s] = rgbToHsl(r, g, b)

  // Clamp saturation to <= 50% for a calm, professional look
  const clampedS = Math.min(50, Math.max(15, s))
  // Target lightness ~65-75% for high contrast against dark backdrop
  const targetL = 70

  const litHex = hslToHex(h, clampedS, targetL)
  // Background tinted slightly with hue at 5% lightness
  const bgHex = hslToHex(h, Math.min(30, clampedS), 5)

  return {
    id: 'system',
    name: 'System',
    background: bgHex,
    dotLit: litHex,
    dotUnlit: `rgba(${r}, ${g}, ${b}, 0.08)`,
    accent: litHex,
    glow: `rgba(${r}, ${g}, ${b}, 0.08)`,
  }
}

export function getTheme(themeId: ThemeId = 'mono', systemAccentHex?: string | null): ColorTheme {
  if (themeId === 'system') {
    return buildSystemTheme(systemAccentHex)
  }
  if (themeId in COLOR_THEMES) {
    return COLOR_THEMES[themeId as (typeof PRIMARY_THEME_IDS)[number]]
  }
  if (themeId in LEGACY_MAP) {
    return COLOR_THEMES[LEGACY_MAP[themeId]]
  }
  return COLOR_THEMES.mono
}
