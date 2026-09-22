import { memo, useEffect, useState } from 'react'

// ─── 5x7 Matrix Font (Letters, Digits, Symbols for in-notch display) ───────────

export const FONT_5X7: Record<string, string[]> = {
  // Letters
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],

  // Digits
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],

  // Symbols
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '…': ['00000', '00000', '00000', '00000', '00000', '10101', '10101'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00000', '00100', '00100'],
  '?': ['01110', '10001', '00010', '00100', '00100', '00000', '00100'],
  '%': ['11001', '11010', '00100', '01011', '10011', '00000', '00000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  '(': ['00110', '01000', '10000', '10000', '10000', '01000', '00110'],
  ')': ['01100', '00010', '00001', '00001', '00001', '00010', '01100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

// ─── 7x11 Matrix Font (High Definition Timer Glyphs) ───────────────────────────

export const FONT_7X11: Record<string, string[]> = {
  '0': [
    '0111110',
    '1100011',
    '1000001',
    '1000001',
    '1000001',
    '1000001',
    '1000001',
    '1000001',
    '1000001',
    '1100011',
    '0111110',
  ],
  '1': [
    '0001100',
    '0011100',
    '0101100',
    '0001100',
    '0001100',
    '0001100',
    '0001100',
    '0001100',
    '0001100',
    '0001100',
    '0111111',
  ],
  '2': [
    '0111110',
    '1100011',
    '0000011',
    '0000011',
    '0000110',
    '0001100',
    '0011000',
    '0110000',
    '1100000',
    '1100011',
    '1111111',
  ],
  '3': [
    '0111110',
    '1100011',
    '0000011',
    '0000011',
    '0011110',
    '0000011',
    '0000011',
    '0000011',
    '0000011',
    '1100011',
    '0111110',
  ],
  '4': [
    '0000110',
    '0001110',
    '0010110',
    '0100110',
    '1000110',
    '1000110',
    '1111111',
    '0000110',
    '0000110',
    '0000110',
    '0000110',
  ],
  '5': [
    '1111111',
    '1100000',
    '1100000',
    '1100000',
    '1111110',
    '0000011',
    '0000011',
    '0000011',
    '0000011',
    '1100011',
    '0111110',
  ],
  '6': [
    '0011110',
    '0110000',
    '1100000',
    '1100000',
    '1111110',
    '1100011',
    '1100001',
    '1100001',
    '1100011',
    '1100011',
    '0111110',
  ],
  '7': [
    '1111111',
    '0000011',
    '0000011',
    '0000110',
    '0001100',
    '0001100',
    '0011000',
    '0011000',
    '0110000',
    '0110000',
    '0110000',
  ],
  '8': [
    '0111110',
    '1100011',
    '1100011',
    '1100011',
    '0111110',
    '1100011',
    '1100011',
    '1100011',
    '1100011',
    '1100011',
    '0111110',
  ],
  '9': [
    '0111110',
    '1100011',
    '1100011',
    '1100001',
    '1100011',
    '0111111',
    '0000011',
    '0000011',
    '0000011',
    '0000110',
    '0111100',
  ],
  ':': [
    '0000000',
    '0000000',
    '0011000',
    '0011000',
    '0000000',
    '0000000',
    '0000000',
    '0011000',
    '0011000',
    '0000000',
    '0000000',
  ],
  '.': [
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0011000',
    '0011000',
  ],
  '-': [
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '1111111',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
  ],
  ' ': [
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
    '0000000',
  ],
}

export type MatrixGrid = '5x7' | '7x11'

export interface DotMatrixProps {
  value: string
  grid?: MatrixGrid
  className?: string
  litColor?: string
  unlitColor?: string
  glowColor?: string
  dprOverride?: number
  reduceMotion?: boolean
}

export interface ComputedDot {
  cx: number
  cy: number
  r: number
  isLit: boolean
  key: string
}

export interface DotGridCalculation {
  viewBox: string
  width: number
  height: number
  dots: ComputedDot[]
}

/**
 * Calculates dot matrix grid dimensions and snapped integer/half-integer coordinates.
 */
export function computeDotGrid(
  value: string,
  grid: MatrixGrid = '5x7',
  _dpr: number = 1
): DotGridCalculation {
  const chars = value.split('')
  const is7x11 = grid === '7x11'
  const font = is7x11 ? FONT_7X11 : FONT_5X7
  const fallback = is7x11 ? FONT_7X11[' '] : FONT_5X7[' ']

  const colsPerChar = is7x11 ? 7 : 5
  const rowsPerChar = is7x11 ? 11 : 7

  // Pixel grid metrics snapped to integer values
  const dotDiameter = is7x11 ? 4 : 2
  const dotGap = is7x11 ? 2 : 1
  const dotPitch = dotDiameter + dotGap // step between dot centers (6 for 7x11, 3 for 5x7)
  const charGap = is7x11 ? 4 : 3 // gap between characters in px
  const dotRadius = dotDiameter / 2 // 2.0 or 1.0

  const charWidth = colsPerChar * dotPitch - dotGap
  const totalWidth = Math.max(16, chars.length * (charWidth + charGap) - charGap)
  const totalHeight = rowsPerChar * dotPitch - dotGap

  const dots: ComputedDot[] = []

  chars.forEach((rawChar, ci) => {
    const char = is7x11 ? rawChar : rawChar.toUpperCase()
    const rows = font[char] ?? (is7x11 ? FONT_5X7[char] ?? fallback : fallback)
    const ox = ci * (charWidth + charGap)

    rows.forEach((rowStr, ri) => {
      // pad or trim row to colsPerChar
      const padded = rowStr.padEnd(colsPerChar, '0').slice(0, colsPerChar)
      for (let di = 0; di < padded.length; di++) {
        const isLit = padded[di] === '1'
        const cx = ox + di * dotPitch + dotRadius
        const cy = ri * dotPitch + dotRadius
        dots.push({
          cx: Math.round(cx * 2) / 2, // Integer or exact half-integer center
          cy: Math.round(cy * 2) / 2,
          r: dotRadius,
          isLit,
          key: `${ci}-${ri}-${di}`,
        })
      }
    })
  })

  return {
    viewBox: `0 0 ${Math.round(totalWidth)} ${Math.round(totalHeight)}`,
    width: Math.round(totalWidth),
    height: Math.round(totalHeight),
    dots,
  }
}

/**
 * HD Crisp Dot-Matrix display component.
 * Renders on an exact pixel grid with subtle LED glow for lit dots.
 */
export const DotMatrix = memo(function DotMatrix({
  value,
  grid = '5x7',
  className = '',
  litColor = '#FFFFFF',
  unlitColor = 'rgba(255, 255, 255, 0.08)',
  glowColor,
  dprOverride,
  reduceMotion = false,
}: DotMatrixProps) {
  const [dpr, setDpr] = useState(
    dprOverride ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  )

  useEffect(() => {
    if (dprOverride !== undefined) {
      setDpr(dprOverride)
      return
    }
    if (typeof window === 'undefined') return

    const updateDpr = () => {
      setDpr(window.devicePixelRatio || 1)
    }

    const mql = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`)
    mql?.addEventListener?.('change', updateDpr)
    window.addEventListener('resize', updateDpr)

    return () => {
      mql?.removeEventListener?.('change', updateDpr)
      window.removeEventListener('resize', updateDpr)
    }
  }, [dprOverride])

  const { viewBox, width, height, dots } = computeDotGrid(value, grid, dpr)

  const activeGlow =
    glowColor || (litColor.startsWith('#') ? `${litColor}4D` : 'rgba(255, 255, 255, 0.3)')

  return (
    <svg
      className={`dot-matrix ${className}`}
      viewBox={viewBox}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      aria-label={value}
      role="img"
      shapeRendering="geometricPrecision"
      style={{
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
      }}
    >
      {dots.map((dot) => {
        const isLit = dot.isLit
        return (
          <circle
            key={dot.key}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            className={isLit ? 'dot-lit' : 'dot-unlit'}
            style={{
              fill: isLit ? litColor : unlitColor,
              filter:
                isLit && !reduceMotion
                  ? `drop-shadow(0px 0px 1px ${activeGlow}) drop-shadow(0px 0px 2px ${activeGlow})`
                  : undefined,
              transition: reduceMotion ? 'none' : 'fill 0.1s ease',
            }}
          />
        )
      })}
    </svg>
  )
})
