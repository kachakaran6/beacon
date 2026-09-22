import { memo, useEffect, useRef, useState } from 'react'
import {
  BLINK_DURATION_MS,
  calculateCursorTrackingOffset,
  CURSOR_PROXIMITY_PX,
  DIRECTION_OFFSETS,
  getNextBlinkInterval,
  getNextHoldInterval,
  getNextRestInterval,
  getRandomGlanceDirection,
  GLANCE_TRANSITION_MS,
  HAPPY_SQUINT_PATTERN,
  PUPIL_PATTERN,
  RETURN_TRANSITION_MS,
  SCLERA_FRAME_PATTERN,
} from '../companion-logic'

export interface CompanionEyesProps {
  litColor?: string
  unlitColor?: string
  glowColor?: string
  isFocusSession?: boolean
  sessionJustFinished?: boolean
  reduceMotion?: boolean
  isActive?: boolean
}

/**
 * Expressive Cartoon Eyes Companion in Dot-Matrix Visual Language.
 * Stationary Sclera Frame + Movable Full-Opacity Pupil Cluster.
 * Natural Idle Sequence: Rest (2-4s) -> Glance (500-700ms) -> Hold (600-1000ms) -> Return (400ms).
 * Lookaround sequence (~1 in 5 cycles).
 * Real eyelid blink (scaleY collapse), 150px 2D cursor tracking, Pomodoro focus and 2-beat celebration.
 */
export const CompanionEyes = memo(function CompanionEyes({
  litColor = '#E8E8E8',
  unlitColor = 'rgba(232, 232, 232, 0.06)',
  glowColor,
  isFocusSession = false,
  sessionJustFinished = false,
  reduceMotion = false,
  isActive = true,
}: CompanionEyesProps) {
  // State for celebration & blink
  const [blinkScaleY, setBlinkScaleY] = useState(1)
  const [isCelebrationSquint, setIsCelebrationSquint] = useState(false)
  const [pupilPos, setPupilPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Animation & state machine refs
  const rafId = useRef<number | null>(null)
  const lastTime = useRef<number>(performance.now())

  // Blink timer
  const lastBlinkTime = useRef<number>(performance.now())
  const nextBlinkDelay = useRef<number>(getNextBlinkInterval())

  // Idle state machine: 'rest' | 'glance' | 'hold' | 'return' | 'lookaround_left' | 'lookaround_up' | 'lookaround_return'
  const stateMode = useRef<string>('rest')
  const stateTimer = useRef<number>(getNextRestInterval())
  const currentPupilTarget = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const glanceCycleCount = useRef<number>(0)

  // Cursor tracking
  const cursorTarget = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const isCursorNear = useRef<boolean>(false)

  // Lerp position
  const currentX = useRef<number>(0)
  const currentY = useRef<number>(0)

  // Celebration trigger on pomodoro completion (2-beat sequence)
  useEffect(() => {
    if (sessionJustFinished) {
      // Beat 1: Happy squint for 350ms
      setIsCelebrationSquint(true)
      const t1 = setTimeout(() => {
        setIsCelebrationSquint(false)
        // Beat 2: Happy single blink
        setBlinkScaleY(0.08)
        const t2 = setTimeout(() => {
          setBlinkScaleY(1)
        }, 150)
        return () => clearTimeout(t2)
      }, 400)
      return () => clearTimeout(t1)
    }
  }, [sessionJustFinished])

  // Mouse / cursor tracking listener
  useEffect(() => {
    if (!isActive || reduceMotion) return

    const handlePointerMove = (e: PointerEvent) => {
      const notchCenterX = window.innerWidth / 2
      const tracking = calculateCursorTrackingOffset(
        e.clientX,
        e.clientY,
        notchCenterX,
        15,
        CURSOR_PROXIMITY_PX
      )
      isCursorNear.current = tracking.active
      cursorTarget.current = tracking.offset
    }

    const handlePointerLeave = () => {
      isCursorNear.current = false
      cursorTarget.current = { x: 0, y: 0 }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [isActive, reduceMotion])

  // Core rAF Animation Loop
  useEffect(() => {
    if (!isActive) {
      if (rafId.current) cancelAnimationFrame(rafId.current)
      return
    }

    let running = true

    const loop = (now: number) => {
      if (!running) return

      const delta = Math.min(64, now - lastTime.current)
      lastTime.current = now

      // ── 1. Eyelid Blink Timer ──
      const blinkElapsed = now - lastBlinkTime.current
      if (blinkElapsed > nextBlinkDelay.current) {
        // Eyelid close
        const progress = (blinkElapsed - nextBlinkDelay.current) / BLINK_DURATION_MS
        if (progress < 0.5) {
          setBlinkScaleY(Math.max(0.08, 1 - progress * 2))
        } else if (progress < 1.0) {
          setBlinkScaleY(Math.min(1.0, 0.08 + (progress - 0.5) * 2))
        } else {
          setBlinkScaleY(1)
          lastBlinkTime.current = now
          // If in focus session, blink less frequently (8-10s)
          nextBlinkDelay.current = isFocusSession
            ? 8000 + Math.random() * 2000
            : getNextBlinkInterval()
        }
      }

      // ── 2. Eye Movement & State Machine ──
      if (isFocusSession) {
        // Focus mode: locked dead-center
        currentPupilTarget.current = { x: 0, y: 0 }
      } else if (isCursorNear.current && !reduceMotion) {
        // Cursor tracking interrupt: pupil follows cursor
        currentPupilTarget.current = cursorTarget.current
      } else if (!reduceMotion) {
        // Idle Sequence State Machine
        stateTimer.current -= delta

        if (stateTimer.current <= 0) {
          switch (stateMode.current) {
            case 'rest': {
              glanceCycleCount.current += 1
              // 1 in 5 cycles triggers lookaround (left -> up -> return)
              if (glanceCycleCount.current % 5 === 0) {
                stateMode.current = 'lookaround_left'
                stateTimer.current = 600
                currentPupilTarget.current = DIRECTION_OFFSETS.left
              } else {
                stateMode.current = 'glance'
                stateTimer.current = GLANCE_TRANSITION_MS
                const dir = getRandomGlanceDirection()
                currentPupilTarget.current = DIRECTION_OFFSETS[dir]
              }
              break
            }
            case 'lookaround_left': {
              stateMode.current = 'lookaround_up'
              stateTimer.current = 600
              currentPupilTarget.current = DIRECTION_OFFSETS.up
              break
            }
            case 'lookaround_up': {
              stateMode.current = 'return'
              stateTimer.current = RETURN_TRANSITION_MS
              currentPupilTarget.current = DIRECTION_OFFSETS.center
              break
            }
            case 'glance': {
              stateMode.current = 'hold'
              stateTimer.current = getNextHoldInterval()
              break
            }
            case 'hold': {
              stateMode.current = 'return'
              stateTimer.current = RETURN_TRANSITION_MS
              currentPupilTarget.current = DIRECTION_OFFSETS.center
              break
            }
            case 'return':
            default: {
              stateMode.current = 'rest'
              stateTimer.current = getNextRestInterval()
              currentPupilTarget.current = DIRECTION_OFFSETS.center
              break
            }
          }
        }
      } else {
        currentPupilTarget.current = { x: 0, y: 0 }
      }

      // ── 3. Smooth Damped Spring Lerp ──
      const lerpSpeed = isCursorNear.current ? 0.16 : 0.12
      currentX.current += (currentPupilTarget.current.x - currentX.current) * lerpSpeed
      currentY.current += (currentPupilTarget.current.y - currentY.current) * lerpSpeed

      // Snap tiny values
      if (Math.abs(currentX.current) < 0.04) currentX.current = 0
      if (Math.abs(currentY.current) < 0.04) currentY.current = 0

      setPupilPos({
        x: Math.round(currentX.current * 100) / 100,
        y: Math.round(currentY.current * 100) / 100,
      })

      rafId.current = requestAnimationFrame(loop)
    }

    rafId.current = requestAnimationFrame(loop)

    return () => {
      running = false
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isActive, isFocusSession, reduceMotion])

  // Dimensions: 6 cols x 5 rows per eye, dot pitch 3, dot radius 1
  const dotPitch = 3
  const dotRadius = 1
  const eyeWidth = 6 * dotPitch - 1 // 17px
  const eyeHeight = 5 * dotPitch - 1 // 14px
  const eyeGap = 8 // gap between eyes
  const totalWidth = eyeWidth * 2 + eyeGap // 42px
  const totalHeight = 20

  const eyeOffsetY = Math.round((totalHeight - eyeHeight) / 2) // 3px
  const leftEyeOriginX = 0
  const rightEyeOriginX = eyeWidth + eyeGap

  // Sclera frame dot color (subtle 35% opacity frame)
  const frameColor = litColor.startsWith('#')
    ? `${litColor}55`
    : 'rgba(232, 232, 232, 0.35)'

  // Pupil center offset within 6x5 matrix
  // Un-translated pupil sits at col 2, row 1.5
  const pupilBaseX = 2 * dotPitch
  const pupilBaseY = 1.5 * dotPitch

  return (
    <svg
      className="companion-eyes"
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={totalWidth}
      height={totalHeight}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Companion Mascot"
      role="img"
      shapeRendering="geometricPrecision"
      style={{
        display: 'block',
        overflow: 'visible',
      }}
    >
      {/* Eye Pairs Container with Eyelid Blink Transform */}
      <g
        style={{
          transformOrigin: `${totalWidth / 2}px ${totalHeight / 2}px`,
          transform: `scaleY(${isFocusSession ? 0.85 : blinkScaleY})`,
          transition: reduceMotion ? 'none' : 'transform 0.05s ease-out',
        }}
      >
        {/* Left Eye */}
        <g transform={`translate(${leftEyeOriginX}, ${eyeOffsetY})`}>
          {isCelebrationSquint ? (
            // Happy squint curve
            HAPPY_SQUINT_PATTERN.flatMap((rowStr, ri) =>
              rowStr.split('').map((char, ci) => {
                if (char !== '1') return null
                return (
                  <circle
                    key={`L-sq-${ri}-${ci}`}
                    cx={ci * dotPitch + dotRadius}
                    cy={ri * dotPitch + dotRadius}
                    r={dotRadius}
                    style={{ fill: litColor }}
                  />
                )
              })
            )
          ) : (
            <>
              {/* Outer Sclera Frame (Stationary) */}
              {SCLERA_FRAME_PATTERN.flatMap((rowStr, ri) =>
                rowStr.split('').map((char, ci) => {
                  const isFrameDot = char === '1'
                  return (
                    <circle
                      key={`L-frame-${ri}-${ci}`}
                      cx={ci * dotPitch + dotRadius}
                      cy={ri * dotPitch + dotRadius}
                      r={dotRadius}
                      style={{
                        fill: isFrameDot ? frameColor : unlitColor,
                      }}
                    />
                  )
                })
              )}

              {/* Inner Movable Pupil Cluster (Dense Full-Opacity Lit Dots) */}
              <g
                style={{
                  transform: `translate3d(${pupilPos.x}px, ${pupilPos.y}px, 0)`,
                  transition: reduceMotion ? 'none' : 'transform 0.04s linear',
                }}
              >
                {PUPIL_PATTERN.flatMap((rowStr, ri) =>
                  rowStr.split('').map((_char, ci) => (
                    <circle
                      key={`L-pupil-${ri}-${ci}`}
                      cx={pupilBaseX + ci * dotPitch + dotRadius}
                      cy={pupilBaseY + ri * dotPitch + dotRadius}
                      r={dotRadius}
                      style={{
                        fill: litColor,
                        filter: glowColor ? `drop-shadow(0 0 1px ${glowColor})` : undefined,
                      }}
                    />
                  ))
                )}
              </g>
            </>
          )}
        </g>

        {/* Right Eye */}
        <g transform={`translate(${rightEyeOriginX}, ${eyeOffsetY})`}>
          {isCelebrationSquint ? (
            // Happy squint curve
            HAPPY_SQUINT_PATTERN.flatMap((rowStr, ri) =>
              rowStr.split('').map((char, ci) => {
                if (char !== '1') return null
                return (
                  <circle
                    key={`R-sq-${ri}-${ci}`}
                    cx={ci * dotPitch + dotRadius}
                    cy={ri * dotPitch + dotRadius}
                    r={dotRadius}
                    style={{ fill: litColor }}
                  />
                )
              })
            )
          ) : (
            <>
              {/* Outer Sclera Frame (Stationary) */}
              {SCLERA_FRAME_PATTERN.flatMap((rowStr, ri) =>
                rowStr.split('').map((char, ci) => {
                  const isFrameDot = char === '1'
                  return (
                    <circle
                      key={`R-frame-${ri}-${ci}`}
                      cx={ci * dotPitch + dotRadius}
                      cy={ri * dotPitch + dotRadius}
                      r={dotRadius}
                      style={{
                        fill: isFrameDot ? frameColor : unlitColor,
                      }}
                    />
                  )
                })
              )}

              {/* Inner Movable Pupil Cluster (Dense Full-Opacity Lit Dots) */}
              <g
                style={{
                  transform: `translate3d(${pupilPos.x}px, ${pupilPos.y}px, 0)`,
                  transition: reduceMotion ? 'none' : 'transform 0.04s linear',
                }}
              >
                {PUPIL_PATTERN.flatMap((rowStr, ri) =>
                  rowStr.split('').map((_char, ci) => (
                    <circle
                      key={`R-pupil-${ri}-${ci}`}
                      cx={pupilBaseX + ci * dotPitch + dotRadius}
                      cy={pupilBaseY + ri * dotPitch + dotRadius}
                      r={dotRadius}
                      style={{
                        fill: litColor,
                        filter: glowColor ? `drop-shadow(0 0 1px ${glowColor})` : undefined,
                      }}
                    />
                  ))
                )}
              </g>
            </>
          )}
        </g>
      </g>
    </svg>
  )
})
