/**
 * Pure state machine and motion math for the Companion Character.
 * Real cartoon eye anatomy: stationary outer sclera frame + movable dense pupil cluster.
 */

export type GlanceDirection =
  | 'center'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'up_left'
  | 'up_right'
  | 'down_left'
  | 'down_right'

export interface Point2D {
  x: number
  y: number
}

export const DIRECTION_OFFSETS: Record<GlanceDirection, Point2D> = {
  center: { x: 0, y: 0 },
  left: { x: -3.5, y: 0 },
  right: { x: 3.5, y: 0 },
  up: { x: 0, y: -2.5 },
  down: { x: 0, y: 2.2 },
  up_left: { x: -2.8, y: -2.0 },
  up_right: { x: 2.8, y: -2.0 },
  down_left: { x: -2.8, y: 1.8 },
  down_right: { x: 2.8, y: 1.8 },
}

export const BLINK_MIN_INTERVAL_MS = 3000
export const BLINK_MAX_INTERVAL_MS = 6000
export const BLINK_DURATION_MS = 120

export const REST_MIN_INTERVAL_MS = 2000
export const REST_MAX_INTERVAL_MS = 4000
export const GLANCE_TRANSITION_MS = 600
export const HOLD_MIN_INTERVAL_MS = 600
export const HOLD_MAX_INTERVAL_MS = 1000
export const RETURN_TRANSITION_MS = 400

export const CURSOR_PROXIMITY_PX = 150
export const MAX_PUPIL_OFFSET_X = 3.5
export const MAX_PUPIL_OFFSET_Y = 2.5

/**
 * Returns a randomized blink interval between 3000ms and 6000ms.
 */
export function getNextBlinkInterval(randomFn: () => number = Math.random): number {
  return BLINK_MIN_INTERVAL_MS + randomFn() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS)
}

/**
 * Returns a randomized rest duration between 2000ms and 4000ms.
 */
export function getNextRestInterval(randomFn: () => number = Math.random): number {
  return REST_MIN_INTERVAL_MS + randomFn() * (REST_MAX_INTERVAL_MS - REST_MIN_INTERVAL_MS)
}

/**
 * Returns a randomized hold duration between 600ms and 1000ms.
 */
export function getNextHoldInterval(randomFn: () => number = Math.random): number {
  return HOLD_MIN_INTERVAL_MS + randomFn() * (HOLD_MAX_INTERVAL_MS - HOLD_MIN_INTERVAL_MS)
}

/**
 * Picks a random directional glance (excluding center).
 */
export function getRandomGlanceDirection(randomFn: () => number = Math.random): GlanceDirection {
  const directions: GlanceDirection[] = [
    'left',
    'right',
    'up',
    'down',
    'up_left',
    'up_right',
    'down_left',
    'down_right',
  ]
  const idx = Math.floor(randomFn() * directions.length)
  return directions[idx] ?? 'left'
}

/**
 * Calculates clamped 2D cursor tracking offset relative to notch center (0, 0).
 */
export function calculateCursorTrackingOffset(
  cursorX: number,
  cursorY: number,
  notchCenterX: number,
  notchCenterY: number = 15,
  proximity: number = CURSOR_PROXIMITY_PX
): { active: boolean; offset: Point2D } {
  const dx = cursorX - notchCenterX
  const dy = cursorY - notchCenterY
  const distance = Math.hypot(dx, dy)

  if (distance > proximity || distance === 0) {
    return { active: false, offset: { x: 0, y: 0 } }
  }

  // Smooth normalized directional travel clamped to eye boundary
  const normalizedX = Math.max(-1, Math.min(1, dx / proximity))
  const normalizedY = Math.max(-1, Math.min(1, dy / proximity))

  return {
    active: true,
    offset: {
      x: Number((normalizedX * MAX_PUPIL_OFFSET_X).toFixed(2)),
      y: Number((normalizedY * MAX_PUPIL_OFFSET_Y).toFixed(2)),
    },
  }
}

/**
 * Eye Frame Dot Matrix: 6 cols x 5 rows per eye.
 * '1' = Frame dot (lit at 35% opacity), '0' = Empty socket.
 */
export const SCLERA_FRAME_PATTERN = [
  '011110',
  '100001',
  '100001',
  '100001',
  '011110',
]

/**
 * Pupil Cluster: 2x2 dense full-opacity dots.
 * Sits at center of 6x5 matrix (cols 2..3, rows 1..2) when un-translated.
 */
export const PUPIL_PATTERN = [
  '11',
  '11',
]

/**
 * Happy squint eye matrix for celebration (upward happy curve ^ ^).
 */
export const HAPPY_SQUINT_PATTERN = [
  '000000',
  '011110',
  '100001',
  '000000',
  '000000',
]
