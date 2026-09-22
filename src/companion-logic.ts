export interface CompanionState {
  mode: 'idle' | 'blinking' | 'focus' | 'happy'
  eyeOffsetX: number
  eyeOffsetY: number
  blinkProgress: number // 0 (open) to 1 (closed)
}

export const BLINK_MIN_INTERVAL_MS = 3000
export const BLINK_MAX_INTERVAL_MS = 6000
export const BLINK_DURATION_MS = 120
export const GLANCE_DURATION_MS = 800
export const MAX_CURSOR_OFFSET_PX = 6 // clamped to ~2 dots

/**
 * Returns a randomized blink delay between 3000ms and 6000ms.
 */
export function getNextBlinkDelay(randomFn: () => number = Math.random): number {
  return BLINK_MIN_INTERVAL_MS + randomFn() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS)
}

/**
 * Calculates clamped cursor tracking offset in pixels based on pointer position relative to notch center.
 */
export function calculateCursorOffset(
  pointerX: number,
  notchCenterX: number,
  proximityRange = 240
): number {
  const diff = pointerX - notchCenterX
  if (Math.abs(diff) > proximityRange) return 0
  const normalized = diff / proximityRange // -1 to 1
  return Math.max(-MAX_CURSOR_OFFSET_PX, Math.min(MAX_CURSOR_OFFSET_PX, normalized * MAX_CURSOR_OFFSET_PX))
}

/**
 * Eye shape dot patterns (4x4 dot matrix per eye).
 * '1' is lit, '0' is unlit.
 */
export const EYE_PATTERNS = {
  open: [
    '0110',
    '1111',
    '1111',
    '0110',
  ],
  blink: [
    '0000',
    '1111',
    '0000',
    '0000',
  ],
  focus: [
    '0000',
    '1111',
    '1111',
    '0000',
  ],
  happy: [
    '0110',
    '1001',
    '0000',
    '0000',
  ],
}
