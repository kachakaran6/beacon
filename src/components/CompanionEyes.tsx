import { memo, useEffect, useRef, useState } from 'react'
import {
  BLINK_DURATION_MS,
  calculateCursorOffset,
  EYE_PATTERNS,
  getNextBlinkDelay,
  GLANCE_DURATION_MS,
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
 * Animated Dot-Matrix Companion character.
 * Renders two minimal eyes built entirely out of the dot-matrix language.
 * Idle loop: blinks every 3-6s, subtle slow glances, smoothed cursor tracking.
 * Focus state during Pomodoro, happy squint on completion.
 * Fully GPU accelerated (transform only) and pauses rAF when inactive.
 */
export const CompanionEyes = memo(function CompanionEyes({
  litColor = '#FFFFFF',
  unlitColor = 'rgba(255, 255, 255, 0.08)',
  glowColor,
  isFocusSession = false,
  sessionJustFinished = false,
  reduceMotion = false,
  isActive = true,
}: CompanionEyesProps) {
  const [blink, setBlink] = useState(false)
  const [happy, setHappy] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)

  const rafId = useRef<number | null>(null)
  const lastBlinkTime = useRef<number>(performance.now())
  const nextBlinkDelay = useRef<number>(getNextBlinkDelay())
  const lastGlanceTime = useRef<number>(performance.now())
  const glanceEndTime = useRef<number>(0)
  const glanceTarget = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const cursorTargetX = useRef<number>(0)
  const currentLerpX = useRef<number>(0)
  const currentLerpY = useRef<number>(0)
  const isPointerNear = useRef<boolean>(false)

  // Happy celebration trigger when pomodoro session completes
  useEffect(() => {
    if (sessionJustFinished) {
      setHappy(true)
      const t = setTimeout(() => setHappy(false), 1600)
      return () => clearTimeout(t)
    }
  }, [sessionJustFinished])

  // Mouse tracking near the notch
  useEffect(() => {
    if (!isActive || reduceMotion) return

    const handlePointerMove = (e: PointerEvent) => {
      const notchCenterX = window.innerWidth / 2
      const offset = calculateCursorOffset(e.clientX, notchCenterX, 280)
      cursorTargetX.current = offset
      isPointerNear.current = Math.abs(e.clientX - notchCenterX) < 280 && e.clientY < 200
    }

    const handlePointerLeave = () => {
      cursorTargetX.current = 0
      isPointerNear.current = false
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [isActive, reduceMotion])

  // Core rAF animation loop
  useEffect(() => {
    if (!isActive) {
      if (rafId.current) cancelAnimationFrame(rafId.current)
      return
    }

    let running = true

    const loop = (now: number) => {
      if (!running) return

      // ── 1. Blink Scheduler (3-6s random interval, 120ms duration) ──
      const elapsedSinceBlink = now - lastBlinkTime.current
      if (elapsedSinceBlink > nextBlinkDelay.current) {
        if (!blink) setBlink(true)
        if (elapsedSinceBlink > nextBlinkDelay.current + BLINK_DURATION_MS) {
          setBlink(false)
          lastBlinkTime.current = now
          nextBlinkDelay.current = getNextBlinkDelay()
        }
      }

      // ── 2. Glance & Tracking (if not in focus mode and not reduced motion) ──
      if (!isFocusSession && !reduceMotion) {
        // Occasional slow glance every 6-9s
        if (!isPointerNear.current && now - lastGlanceTime.current > 7000) {
          lastGlanceTime.current = now
          glanceEndTime.current = now + GLANCE_DURATION_MS
          const dx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() > 0.4 ? 3 : 2)
          const dy = Math.random() > 0.7 ? -1 : 0
          glanceTarget.current = { x: dx, y: dy }
        }

        let targetX = 0
        let targetY = 0

        if (isPointerNear.current) {
          targetX = cursorTargetX.current
        } else if (now < glanceEndTime.current) {
          targetX = glanceTarget.current.x
          targetY = glanceTarget.current.y
        }

        // Spring / smooth lerp
        currentLerpX.current += (targetX - currentLerpX.current) * 0.12
        currentLerpY.current += (targetY - currentLerpY.current) * 0.12

        // Snap tiny drifts to 0
        if (Math.abs(currentLerpX.current) < 0.05) currentLerpX.current = 0
        if (Math.abs(currentLerpY.current) < 0.05) currentLerpY.current = 0

        setOffsetX(Math.round(currentLerpX.current * 10) / 10)
        setOffsetY(Math.round(currentLerpY.current * 10) / 10)
      } else {
        setOffsetX(0)
        setOffsetY(0)
      }

      rafId.current = requestAnimationFrame(loop)
    }

    rafId.current = requestAnimationFrame(loop)

    return () => {
      running = false
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isActive, isFocusSession, reduceMotion, blink])

  // Determine active eye glyph matrix
  const pattern = happy
    ? EYE_PATTERNS.happy
    : blink
    ? EYE_PATTERNS.blink
    : isFocusSession
    ? EYE_PATTERNS.focus
    : EYE_PATTERNS.open

  const activeGlow =
    glowColor || (litColor.startsWith('#') ? `${litColor}4D` : 'rgba(255, 255, 255, 0.3)')

  // Dot dimensions: 4x4 matrix per eye, dot diameter 2, step 3
  const dotRadius = 1
  const dotPitch = 3
  const eyeWidth = 4 * dotPitch - 1 // 11px
  const eyeHeight = 4 * dotPitch - 1 // 11px
  const eyeGap = 10 // gap between eyes
  const totalWidth = eyeWidth * 2 + eyeGap // ~32px
  const totalHeight = 20 // matches notch height

  const eyeOffsetY = Math.round((totalHeight - eyeHeight) / 2) // 4.5 -> 5
  const leftEyeOriginX = 0
  const rightEyeOriginX = eyeWidth + eyeGap

  return (
    <svg
      className="companion-eyes"
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={totalWidth}
      height={totalHeight}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Companion"
      role="img"
      shapeRendering="geometricPrecision"
      style={{
        display: 'block',
        overflow: 'visible',
      }}
    >
      {/* Both Eyes Group with Hardware accelerated transform */}
      <g
        style={{
          transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
          transition: reduceMotion ? 'none' : 'transform 0.05s linear',
        }}
      >
        {/* Left Eye */}
        <g transform={`translate(${leftEyeOriginX}, ${eyeOffsetY})`}>
          {pattern.flatMap((rowStr, ri) =>
            rowStr.split('').map((char, ci) => {
              const isLit = char === '1'
              return (
                <circle
                  key={`L-${ri}-${ci}`}
                  cx={ci * dotPitch + dotRadius}
                  cy={ri * dotPitch + dotRadius}
                  r={dotRadius}
                  className={isLit ? 'dot-lit' : 'dot-unlit'}
                  style={{
                    fill: isLit ? litColor : unlitColor,
                    filter:
                      isLit && !reduceMotion
                        ? `drop-shadow(0px 0px 1px ${activeGlow}) drop-shadow(0px 0px 2px ${activeGlow})`
                        : undefined,
                  }}
                />
              )
            })
          )}
        </g>

        {/* Right Eye */}
        <g transform={`translate(${rightEyeOriginX}, ${eyeOffsetY})`}>
          {pattern.flatMap((rowStr, ri) =>
            rowStr.split('').map((char, ci) => {
              const isLit = char === '1'
              return (
                <circle
                  key={`R-${ri}-${ci}`}
                  cx={ci * dotPitch + dotRadius}
                  cy={ri * dotPitch + dotRadius}
                  r={dotRadius}
                  className={isLit ? 'dot-lit' : 'dot-unlit'}
                  style={{
                    fill: isLit ? litColor : unlitColor,
                    filter:
                      isLit && !reduceMotion
                        ? `drop-shadow(0px 0px 1px ${activeGlow}) drop-shadow(0px 0px 2px ${activeGlow})`
                        : undefined,
                  }}
                />
              )
            })
          )}
        </g>
      </g>
    </svg>
  )
})
