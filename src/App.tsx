import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BellIcon from 'lucide-react/dist/esm/icons/bell.mjs'
import CheckIcon from 'lucide-react/dist/esm/icons/check.mjs'
import ChevronDownIcon from 'lucide-react/dist/esm/icons/chevron-down.mjs'
import ChevronUpIcon from 'lucide-react/dist/esm/icons/chevron-up.mjs'
import ClockIcon from 'lucide-react/dist/esm/icons/clock.mjs'
import ExternalLinkIcon from 'lucide-react/dist/esm/icons/external-link.mjs'
import GripVerticalIcon from 'lucide-react/dist/esm/icons/grip-vertical.mjs'
import MoreHorizontalIcon from 'lucide-react/dist/esm/icons/more-horizontal.mjs'
import PauseIcon from 'lucide-react/dist/esm/icons/pause.mjs'
import PencilIcon from 'lucide-react/dist/esm/icons/pencil.mjs'
import PlayIcon from 'lucide-react/dist/esm/icons/play.mjs'
import PlusIcon from 'lucide-react/dist/esm/icons/plus.mjs'
import RefreshCwIcon from 'lucide-react/dist/esm/icons/refresh-cw.mjs'
import RotateCcwIcon from 'lucide-react/dist/esm/icons/rotate-ccw.mjs'
import ShieldIcon from 'lucide-react/dist/esm/icons/shield.mjs'
import SlidersHorizontalIcon from 'lucide-react/dist/esm/icons/sliders-horizontal.mjs'
import Trash2Icon from 'lucide-react/dist/esm/icons/trash-2.mjs'
import XIcon from 'lucide-react/dist/esm/icons/x.mjs'
import './App.css'
import { DotMatrix } from './components/DotMatrix'
import { CompanionEyes } from './components/CompanionEyes'
import { getTheme, THEME_LIST } from './themes'
import type { ThemeId } from './themes'
import {
  DEFAULT_NOTCH_SOURCE_ORDER,
  evaluateNotchContent,
  NOTCH_SOURCES,
} from './notch-content'
import type { NotchContentMode } from './notch-content'
import type { CalEvent, DisplayInfo, NotchAlign, Priority, Task } from './store'
import {
  DEFAULT_NOTCH,
  flushToDisk,
  hydrateFromDisk,
  parseTaskInput,
  startPersistence,
  useStore,
} from './store'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const api = () => window.beacon

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatClock(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatDate(ts: number | null): string {
  if (!ts) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function playNotificationChime(type: 'event' | 'timer' = 'event') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    if (type === 'event') {
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(523.25, now)
      gain1.gain.setValueAtTime(0.15, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.4)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(783.99, now + 0.15)
      gain2.gain.setValueAtTime(0.2, now + 0.15)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.15)
      osc2.stop(now + 0.7)
    } else {
      const freqs = [659.25, 783.99, 1046.5]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const startTime = now + idx * 0.12
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0.18, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(startTime)
        osc.stop(startTime + 0.5)
      })
    }
  } catch {
    // Ignore audio context errors
  }
}

// ─── Floating Context Menu Component ──────────────────────────────────────────

function ContextMenu({
  x,
  y,
  onClose,
  showToast,
  onSelectTab,
}: {
  x: number
  y: number
  onClose: () => void
  showToast: (m: string) => void
  onSelectTab: (tab: Tab) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const isRunning = useStore((s) => s.isRunning)
  const theme = useStore((s) => s.theme) ?? 'classic'

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const left = Math.min(x, Math.max(10, window.innerWidth - 230))
  const top = Math.min(y, Math.max(10, window.innerHeight - 360))

  return (
    <motion.div
      ref={menuRef}
      className="beacon-context-menu"
      style={{ left, top }}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="ctx-group-label">Quick Actions</div>
      <button
        className="ctx-item"
        onClick={() => {
          onClose()
          onSelectTab('workspace')
          setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>('#task-input')
            input?.focus()
          }, 100)
        }}
      >
        <PlusIcon size={13} />
        <span>Add Task</span>
        <span className="ctx-shortcut">Ctrl+Alt+N</span>
      </button>

      <button
        className="ctx-item"
        onClick={() => {
          onClose()
          useStore.getState().toggleTimer()
          showToast(isRunning ? 'Timer paused' : 'Timer started')
        }}
      >
        {isRunning ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
        <span>{isRunning ? 'Pause Focus Timer' : 'Start Focus Timer'}</span>
        <span className="ctx-shortcut">Ctrl+Alt+P</span>
      </button>

      <button
        className="ctx-item"
        onClick={() => {
          onClose()
          onSelectTab('workspace')
          setTimeout(() => {
            const textarea = document.querySelector<HTMLTextAreaElement>('.notepad-textarea')
            textarea?.focus()
          }, 100)
        }}
      >
        <PencilIcon size={13} />
        <span>Quick Notepad</span>
      </button>

      <div className="ctx-divider" />

      <div className="ctx-group-label">Notch Alignment</div>
      <div className="ctx-row-btns">
        {(['left', 'center', 'right'] as NotchAlign[]).map((align) => (
          <button
            key={align}
            className="ctx-mini-btn"
            onClick={() => {
              useStore.getState().setNotchSettings({ align })
              onClose()
            }}
          >
            {align.charAt(0).toUpperCase() + align.slice(1)}
          </button>
        ))}
      </div>

      <div className="ctx-divider" />

      <div className="ctx-group-label">Notch Theme</div>
      <div className="ctx-theme-pills">
        {(['classic', 'mono', 'amber', 'sage', 'rosewood'] as ThemeId[]).map((tId) => (
          <button
            key={tId}
            className={`ctx-theme-pill ${theme === tId ? 'active' : ''}`}
            onClick={() => {
              useStore.getState().setTheme(tId)
              onClose()
            }}
          >
            {tId.charAt(0).toUpperCase() + tId.slice(1)}
          </button>
        ))}
      </div>

      <div className="ctx-divider" />

      <button
        className="ctx-item"
        onClick={() => {
          onClose()
          api()?.openApp()
        }}
      >
        <ExternalLinkIcon size={13} />
        <span>Open Standalone App</span>
      </button>

      <button
        className="ctx-item ctx-item--close"
        onClick={() => {
          onClose()
          api()?.collapse()
        }}
      >
        <XIcon size={13} />
        <span>Hide Panel</span>
        <span className="ctx-shortcut">Esc</span>
      </button>
    </motion.div>
  )
}

// ─── Toast Component ──────────────────────────────────────────────────────────

function Toast({
  message,
  action,
  onAction,
  onDone,
}: {
  message: string
  action?: string
  onAction?: () => void
  onDone: () => void
}) {
  useEffect(() => {
    if (!action) {
      const t = setTimeout(onDone, 3000)
      return () => clearTimeout(t)
    }
  }, [action, onDone])

  return (
    <motion.div
      className="toast"
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    >
      <span>{message}</span>
      {action && onAction && (
        <button className="toast-action-btn" onClick={onAction}>
          {action}
        </button>
      )}
    </motion.div>
  )
}

// ─── App Component ────────────────────────────────────────────────────────────

type Tab = 'workspace' | 'insights' | 'settings'

export default function App() {
  const appMode = new URLSearchParams(window.location.search).has('app')
  const [open, setOpen] = useState(appMode)
  const [tab, setTab] = useState<Tab>('workspace')
  const [toastMsg, setToastMsg] = useState<{ text: string; action?: string; onAction?: () => void } | null>(null)
  const [clockStr, setClockStr] = useState(formatClock())
  const [pillLeft, setPillLeft] = useState(0)
  const [originXRatio, setOriginXRatio] = useState(0.5)
  const animatingClose = useRef(false)

  // Store slices
  const isRunning = useStore((s) => s.isRunning)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const duration = useStore((s) => s.duration)
  const sessions = useStore((s) => s.sessions)
  const activeTaskId = useStore((s) => s.activeTaskId)
  const tasks = useStore((s) => s.tasks)
  const telemetryConsent = useStore((s) => s.telemetryConsent)
  const theme = useStore((s) => s.theme) ?? 'classic'
  const notchContentMode = useStore((s) => s.notchContentMode) ?? 'smart'
  const notchSources = useStore((s) => s.notchSources) ?? ['clock', 'timer']
  const notchSourceOrder = useStore((s) => s.notchSourceOrder) ?? DEFAULT_NOTCH_SOURCE_ORDER
  const notchCycleInterval = useStore((s) => s.notchCycleInterval) ?? 5
  const reduceAnimations = useStore((s) => s.reduceAnimations) ?? false

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      ? true
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  const effectiveReduceAnimations = reduceAnimations || prefersReducedMotion

  const [systemAccent, setSystemAccent] = useState<string | null>(null)
  const [cycleIndex, setCycleIndex] = useState(0)
  const [sessionJustFinished, setSessionJustFinished] = useState(false)
  const prevSessions = useRef(sessions)

  const activeTask =
    tasks.find((t) => t.id === activeTaskId) ??
    tasks.find((t) => !t.completed) ??
    null

  // ── Initialise persistence, hydration & system accent ───────────────────────
  useEffect(() => {
    let unsub: (() => void) | undefined
    hydrateFromDisk().then(() => {
      unsub = startPersistence()
    })
    api()?.getAccentColor?.().then((accent) => {
      if (accent) setSystemAccent(accent)
    })
    return () => unsub?.()
  }, [])

  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const notifiedEventsRef = useRef<Set<string>>(new Set())

  // ── Track session finish for Companion celebratory squint & chime ────────────
  useEffect(() => {
    if (sessions > prevSessions.current) {
      setSessionJustFinished(true)
      playNotificationChime('timer')
      api()?.notify('🎉 Session Completed!', 'Great focus session finished!')
      const t = setTimeout(() => setSessionJustFinished(false), 1800)
      prevSessions.current = sessions
      return () => clearTimeout(t)
    }
    prevSessions.current = sessions
  }, [sessions])

  // ── Clock tick & Event Alarms ────────────────────────────────────────────────
  useEffect(() => {
    const checkEventsAndTick = () => {
      const nowStr = formatClock()
      setClockStr(nowStr)

      const today = todayStr()
      const events = useStore.getState().events.filter((e) => e.date === today)

      events.forEach((ev) => {
        if (ev.start && ev.start === nowStr) {
          const key = `${ev.id}_${ev.start}`
          if (!notifiedEventsRef.current.has(key)) {
            notifiedEventsRef.current.add(key)
            api()?.notify(`🔔 Event Reminder: ${ev.title}`, `Event starting at ${ev.start}`)
            setToastMsg({ text: `🔔 Event starting now: ${ev.title}` })
            playNotificationChime('event')
          }
        }
      })
    }

    checkEventsAndTick()
    const t = setInterval(checkEventsAndTick, 3_000)
    return () => clearInterval(t)
  }, [])

  // ── Cycle mode rotation scheduler ──────────────────────────────────────────
  useEffect(() => {
    if (notchContentMode !== 'cycle' || open || appMode) return
    const intervalMs = Math.max(3, Math.min(10, notchCycleInterval)) * 1000
    const t = setInterval(() => {
      setCycleIndex((i) => i + 1)
    }, intervalMs)
    return () => clearInterval(t)
  }, [notchContentMode, notchCycleInterval, open, appMode])

  // ── Timer tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(() => useStore.getState().tick(), 1000)
    return () => clearInterval(t)
  }, [isRunning])

  // ── Input focus tracking for Main process hover guard ───────────────────────
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') {
        api()?.setInputFocused(true)
      }
    }
    const onFocusOut = () => {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName?.toLowerCase()
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          api()?.setInputFocused(false)
        }
      }, 50)
    }
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)
    return () => {
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // ── Before-quit flush ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      void flushToDisk()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── Escape key closes panel ────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !appMode) {
        closePanel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, appMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main Process Coordination & Paint Handshake ───────────────────────────
  useEffect(() => {
    const a = api()
    if (!a) return

    const cleanupLayout = a.onLayoutApply?.((layout) => {
      setPillLeft(layout.pillLeft)
      setOriginXRatio(layout.originX)
      // Wait for 2 requestAnimationFrames to guarantee layout paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          a.ackLayout?.()
        })
      })
    })

    const cleanupOpenStart = a.onOpenStart?.(() => {
      animatingClose.current = false
      setOpen(true)
    })

    const cleanupCloseStart = a.onCloseStart?.(() => {
      if (appMode) return
      animatingClose.current = true
      setOpen(false)
    })

    const cleanupShortcut = a.onShortcut((cmd) => {
      if (cmd === 'expand' || cmd === 'toggle-widget') {
        if (!open) openPanel('shortcut')
        else closePanel()
      }
      if (cmd === 'collapse') {
        closePanel()
      }
      if (cmd === 'quick-add') {
        if (!open) openPanel('shortcut')
        setTab('workspace')
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('#task-input')
          if (input) {
            input.focus()
            input.select()
          }
        }, 150)
      }
      if (cmd === 'toggle-timer') {
        useStore.getState().toggleTimer()
      }
    })

    const cleanupState = a.onWindowStateChanged?.((st) => {
      if (st.originX !== undefined) {
        setOriginXRatio(st.originX)
      }
      if (st.expanded && !open) {
        animatingClose.current = false
        setOpen(true)
      } else if (!st.expanded && open && !appMode) {
        setOpen(false)
      }
    })

    const cleanupUpdates = a.onUpdateStatus?.((status) => {
      useStore.getState().setUpdateStatus(status)
      if (status.status === 'downloaded') {
        setToastMsg({
          text: `Update ready (v${status.version || ''})`,
          action: 'Restart now',
          onAction: () => {
            api()?.quitAndInstallUpdate()
          },
        })
      }
    })

    return () => {
      cleanupLayout?.()
      cleanupOpenStart?.()
      cleanupCloseStart?.()
      cleanupShortcut()
      cleanupState?.()
      cleanupUpdates?.()
    }
  }, [open, appMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Window expand / collapse interop ───────────────────────────────────────
  function openPanel(by: string = 'click') {
    animatingClose.current = false
    api()?.expand(by)
  }

  function closePanel() {
    if (animatingClose.current || appMode) return
    api()?.collapse()
  }

  function onPanelExitComplete() {
    if (!open && !appMode) {
      api()?.notifyCloseDone?.()
      animatingClose.current = false
    }
  }

  const showToast = useCallback((text: string) => setToastMsg({ text }), [])

  // ── Current Theme & Notch content ──────────────────────────────────────────
  const currentTheme = getTheme(theme, systemAccent)

  const notchEval = evaluateNotchContent({
    clockStr,
    isRunning,
    secondsLeft,
    duration,
    sessions,
    activeTaskTitle: activeTask?.title,
    enabledSources: notchSources,
    sourceOrder: notchSourceOrder,
    mode: notchContentMode,
    cycleIndex,
  })

  const progress = Math.max(0, Math.min(1, 1 - secondsLeft / duration))

  return (
    <main
      className={`shell ${open ? 'shell--open' : ''} ${appMode ? 'shell--app' : ''}`}
    >
      {/* Notch Pill with Curated Theme (190x30, bottom radius 15px) */}
      {!open && !appMode && (
        <button
          className="notch"
          style={{
            left: `${pillLeft}px`,
            transform: 'none',
            background: currentTheme.background,
          }}
          aria-label="Open Beacon"
          onClick={() => openPanel('click')}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenuPos({ x: e.clientX, y: e.clientY })
          }}
        >
          {isRunning && (
            <svg className="notch-ring" viewBox="0 0 20 20" aria-hidden="true">
              <circle
                cx="10"
                cy="10"
                r="7"
                className="notch-ring-track"
                style={{ stroke: currentTheme.dotUnlit }}
              />
              <circle
                cx="10"
                cy="10"
                r="7"
                className="notch-ring-fill"
                style={{ stroke: currentTheme.accent }}
                strokeDasharray={`${progress * 43.98} 43.98`}
              />
            </svg>
          )}

          <div className="notch-content-wrap">
            {notchEval.isCompanion ? (
              <CompanionEyes
                litColor={currentTheme.dotLit}
                unlitColor={currentTheme.dotUnlit}
                glowColor={currentTheme.glow}
                isFocusSession={isRunning}
                sessionJustFinished={sessionJustFinished}
                reduceMotion={effectiveReduceAnimations}
                isActive={!open && !appMode}
              />
            ) : (
              <DotMatrix
                value={notchEval.text}
                grid="5x7"
                className="notch-matrix"
                litColor={currentTheme.dotLit}
                unlitColor={currentTheme.dotUnlit}
                glowColor={currentTheme.glow}
                reduceMotion={effectiveReduceAnimations}
              />
            )}

            {notchContentMode === 'cycle' &&
              notchEval.totalCycleItems !== undefined &&
              notchEval.totalCycleItems > 1 && (
                <div className="notch-cycle-indicator">
                  {Array.from({ length: notchEval.totalCycleItems }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`notch-cycle-dot ${idx === notchEval.currentCycleIndex ? 'active' : ''}`}
                      style={{
                        backgroundColor:
                          idx === notchEval.currentCycleIndex
                            ? currentTheme.dotLit
                            : currentTheme.dotUnlit,
                      }}
                    />
                  ))}
                </div>
              )}
          </div>
        </button>
      )}

      {/* Expanded Panel (#0A0A0A, bottom radius 28px) */}
      <AnimatePresence onExitComplete={onPanelExitComplete}>
        {(open || appMode) && (
          <motion.div
            className="panel"
            key="panel"
            style={{
              transformOrigin: `${Math.round(originXRatio * 100)}% 0%`,
            }}
            initial={
              appMode
                ? false
                : effectiveReduceAnimations
                ? { opacity: 0 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              effectiveReduceAnimations
                ? { opacity: 0 }
                : { opacity: 0, y: -4, scale: 0.98 }
            }
            transition={
              effectiveReduceAnimations
                ? { duration: 0.12 }
                : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
            }
            onContextMenu={(e) => {
              if (!appMode) {
                e.preventDefault()
                setContextMenuPos({ x: e.clientX, y: e.clientY })
              }
            }}
          >
            {/* Header */}
            <header className="panel-header">
              <span className="wordmark">Beacon</span>

              <nav className="segmented" role="tablist">
                {(['workspace', 'insights', 'settings'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    className={`segmented-tab ${tab === t ? 'active' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </nav>

              <div className="header-actions">
                <button
                  className="ghost-btn"
                  onClick={() => api()?.openApp()}
                  title="Open full window app"
                  aria-label="Open full app"
                >
                  <ExternalLinkIcon size={14} strokeWidth={1.75} />
                  <span>Open app</span>
                </button>
                {!appMode && (
                  <button
                    className="close-btn"
                    onClick={closePanel}
                    aria-label="Close panel"
                    title="Close (Esc)"
                  >
                    <XIcon size={14} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </header>

            {/* First run telemetry consent banner */}
            {telemetryConsent === null && tab === 'workspace' && (
              <div className="consent-banner">
                <div className="consent-text">
                  <ShieldIcon size={14} strokeWidth={1.75} className="consent-icon" />
                  <span>
                    Help improve Beacon: share anonymous usage stats (a random ID, app version and Windows version). No personal data or content.
                  </span>
                </div>
                <div className="consent-actions">
                  <button
                    className="consent-btn consent-btn--primary"
                    onClick={() => useStore.getState().setTelemetryConsent(true)}
                  >
                    Share anonymous stats
                  </button>
                  <button
                    className="consent-btn consent-btn--secondary"
                    onClick={() => useStore.getState().setTelemetryConsent(false)}
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}

            {/* Body Tabs */}
            <div className="panel-body">
              {tab === 'workspace' && <WorkspaceTab showToast={showToast} />}
              {tab === 'insights' && <InsightsTab />}
              {tab === 'settings' && <SettingsTab showToast={showToast} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <Toast
            key="toast"
            message={toastMsg.text}
            action={toastMsg.action}
            onAction={toastMsg.onAction}
            onDone={() => setToastMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenuPos && (
          <ContextMenu
            x={contextMenuPos.x}
            y={contextMenuPos.y}
            onClose={() => setContextMenuPos(null)}
            showToast={showToast}
            onSelectTab={setTab}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

// ─── Workspace Tab ────────────────────────────────────────────────────────────

function WorkspaceTab({ showToast }: { showToast: (m: string) => void }) {
  return (
    <div className="cards-grid">
      <TasksCard showToast={showToast} />
      <TimerCard />
      <NotepadCard showToast={showToast} />
      <EventsCard showToast={showToast} />
    </div>
  )
}

// ─── Tasks Card (Sage #D3DDCF) ────────────────────────────────────────────────

function TasksCard({ showToast }: { showToast: (m: string) => void }) {
  const tasks = useStore((s) => s.tasks)
  const activeTaskId = useStore((s) => s.activeTaskId)
  const [input, setInput] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pending = tasks.filter((t) => !t.completed)
  const completed = tasks.filter((t) => t.completed)

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    const { title, estimate } = parseTaskInput(trimmed)
    useStore.getState().addTask(title, estimate)
    setInput('')
  }

  function handleFocus() {
    api()?.setInputFocused(true)
  }

  function handleBlur() {
    api()?.setInputFocused(false)
  }

  function handleDrop(targetIdx: number) {
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      useStore.getState().reorderTasks(draggedIdx, targetIdx)
    }
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  return (
    <article className="card card--sage">
      <div className="card-header">
        <span className="card-title">Today</span>
        <span className="card-badge">{pending.length} left</span>
      </div>

      <form className="task-input-wrap" onSubmit={handleAdd}>
        <PlusIcon size={14} strokeWidth={1.75} className="task-input-icon" />
        <input
          id="task-input"
          ref={inputRef}
          className="task-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Add a task… (e.g. Code 45m)"
          autoComplete="off"
          aria-label="Add a task"
        />
      </form>

      <div className="task-list">
        {pending.length === 0 && completed.length === 0 && (
          <div className="empty-state">
            <p>Nothing planned yet.</p>
          </div>
        )}

        {pending.map((task, idx) => (
          <TaskRow
            key={task.id}
            index={idx}
            task={task}
            isActive={task.id === activeTaskId}
            menuOpen={menuId === task.id}
            onMenuToggle={() => setMenuId(menuId === task.id ? null : task.id)}
            onMenuClose={() => setMenuId(null)}
            showToast={showToast}
            isDragging={draggedIdx === idx}
            isDragOver={dragOverIdx === idx}
            onDragStart={(i) => setDraggedIdx(i)}
            onDragOver={(i, e) => {
              e.preventDefault()
              setDragOverIdx(i)
            }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(i) => handleDrop(i)}
            onDragEnd={() => {
              setDraggedIdx(null)
              setDragOverIdx(null)
            }}
          />
        ))}

        {completed.length > 0 && (
          <div className="completed-group">
            <button
              className="completed-toggle"
              onClick={() => setShowCompleted((v) => !v)}
              aria-expanded={showCompleted}
            >
              {showCompleted ? (
                <ChevronUpIcon size={13} strokeWidth={1.75} />
              ) : (
                <ChevronDownIcon size={13} strokeWidth={1.75} />
              )}
              <span>Completed ({completed.length})</span>
            </button>

            {showCompleted && (
              <div className="task-list task-list--completed">
                {completed.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isActive={false}
                    menuOpen={menuId === task.id}
                    onMenuToggle={() => setMenuId(menuId === task.id ? null : task.id)}
                    onMenuClose={() => setMenuId(null)}
                    showToast={showToast}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function TaskRow({
  index,
  task,
  isActive,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  showToast,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  index?: number
  task: Task
  isActive: boolean
  menuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  showToast: (m: string) => void
  isDragging?: boolean
  isDragOver?: boolean
  onDragStart?: (i: number) => void
  onDragOver?: (i: number, e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (i: number) => void
  onDragEnd?: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        onMenuClose()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [menuOpen, onMenuClose])

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    useStore.getState().toggleTask(task.id)
  }

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation()
    useStore.getState().setActive(task.id)
    if (!useStore.getState().isRunning) {
      useStore.getState().toggleTimer()
    }
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onMenuClose()
    useStore.getState().deleteTask(task.id)
    showToast('Task deleted')
  }

  function handleSetPriority(priority: Priority) {
    useStore.getState().editTask(task.id, { priority })
    onMenuClose()
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (editTitle.trim()) {
      useStore.getState().editTask(task.id, { title: editTitle.trim() })
    }
    setIsEditing(false)
    api()?.setInputFocused(false)
  }

  return (
    <div
      ref={rowRef}
      draggable={!task.completed && index !== undefined}
      onDragStart={(e) => {
        if (!task.completed && index !== undefined && onDragStart) {
          e.dataTransfer.effectAllowed = 'move'
          onDragStart(index)
        }
      }}
      onDragOver={(e) => {
        if (!task.completed && index !== undefined && onDragOver) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOver(index, e)
        }
      }}
      onDragLeave={() => {
        if (onDragLeave) onDragLeave()
      }}
      onDrop={(e) => {
        if (!task.completed && index !== undefined && onDrop) {
          e.preventDefault()
          onDrop(index)
        }
      }}
      onDragEnd={() => {
        if (onDragEnd) onDragEnd()
      }}
      className={`task-row ${task.completed ? 'task-row--done' : ''} ${
        isActive ? 'task-row--active' : ''
      } ${isDragging ? 'task-row--dragging' : ''} ${isDragOver ? 'task-row--drag-over' : ''}`}
      role="listitem"
    >
      <div className="task-grip-wrap" aria-hidden="true">
        <GripVerticalIcon size={12} strokeWidth={1.75} className="task-grip" />
      </div>

      <button
        className="task-check"
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onClick={handleCheck}
      >
        {task.completed && <CheckIcon size={12} strokeWidth={2.5} />}
      </button>

      <div
        className="task-content"
        onClick={() => {
          if (!task.completed) useStore.getState().setActive(task.id)
        }}
      >
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="task-edit-form">
            <input
              autoFocus
              className="task-edit-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onFocus={() => api()?.setInputFocused(true)}
              onBlur={() => {
                handleSaveEdit({ preventDefault: () => {} } as React.FormEvent)
              }}
            />
          </form>
        ) : (
          <>
            <span className="task-title" title={task.title}>
              {task.title}
            </span>
            {(task.estimate || task.reminder) && (
              <span className="task-meta">
                {task.estimate && (
                  <span className="task-meta-item">
                    <ClockIcon size={10} strokeWidth={1.75} /> {task.estimate}m
                  </span>
                )}
                {task.reminder && (
                  <span className="task-meta-item">
                    <BellIcon size={10} strokeWidth={1.75} /> {task.reminder}
                  </span>
                )}
              </span>
            )}
          </>
        )}
      </div>

      <div className="task-actions">
        {!task.completed && (
          <button
            className="icon-action-btn"
            aria-label="Start timer with task"
            onClick={handlePlay}
            title="Focus this task"
          >
            <PlayIcon size={12} strokeWidth={1.75} fill="currentColor" />
          </button>
        )}

        <button
          className="icon-action-btn"
          aria-label="More options"
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
        >
          <MoreHorizontalIcon size={13} strokeWidth={1.75} />
        </button>
      </div>

      {menuOpen && (
        <div className="task-popover-menu" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setIsEditing(true)
              onMenuClose()
            }}
          >
            <PencilIcon size={12} strokeWidth={1.75} /> Edit title
          </button>
          {!task.completed && (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  useStore.getState().moveTask(task.id, 'up')
                  onMenuClose()
                }}
              >
                <ChevronUpIcon size={12} strokeWidth={1.75} /> Move up
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  useStore.getState().moveTask(task.id, 'down')
                  onMenuClose()
                }}
              >
                <ChevronDownIcon size={12} strokeWidth={1.75} /> Move down
              </button>
            </>
          )}
          <button role="menuitem" onClick={() => handleSetPriority('high')}>
            Priority: High
          </button>
          <button role="menuitem" onClick={() => handleSetPriority('medium')}>
            Priority: Normal
          </button>
          <button role="menuitem" className="menu-delete" onClick={handleDelete}>
            <Trash2Icon size={12} strokeWidth={1.75} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Timer Card (Lavender #D9D5E6) ───────────────────────────────────────────

const TIMER_PRESETS = [15, 25, 45, 60]

function TimerCard() {
  const isRunning = useStore((s) => s.isRunning)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const duration = useStore((s) => s.duration)
  const sessions = useStore((s) => s.sessions)
  const activeTaskId = useStore((s) => s.activeTaskId)
  const tasks = useStore((s) => s.tasks)
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null

  const [showPopover, setShowPopover] = useState(false)
  const [customMin, setCustomMin] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  const progress = Math.max(0, Math.min(1, 1 - secondsLeft / duration))

  useEffect(() => {
    if (!showPopover) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
        api()?.setInputFocused(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [showPopover])

  function handleSetPreset(min: number) {
    useStore.getState().setDuration(min)
    setShowPopover(false)
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseInt(customMin, 10)
    if (parsed > 0 && parsed <= 180) {
      useStore.getState().setDuration(parsed)
      setShowPopover(false)
      setCustomMin('')
      api()?.setInputFocused(false)
    }
  }

  const sessionText = `Session ${sessions + 1}${activeTask ? ` · ${activeTask.title}` : ''}`

  return (
    <article className="card card--lavender">
      <div className="card-header">
        <span className="card-title">Timer</span>
        <span className="timer-status-badge">
          {isRunning ? 'FOCUS' : secondsLeft < duration ? 'PAUSED' : 'READY'}
        </span>
      </div>

      {/* Responsive DotMatrix SVG: width 100%, max height 72px */}
      <div className="timer-svg-container" aria-label={`Timer ${formatTime(secondsLeft)}`}>
        <DotMatrix
          value={formatTime(secondsLeft)}
          grid="7x11"
          className="timer-matrix"
          litColor="#111111"
          unlitColor="rgba(0, 0, 0, 0.08)"
          glowColor="rgba(0, 0, 0, 0.15)"
        />
      </div>

      {/* Thin Dark Progress Bar */}
      <div
        className="timer-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="timer-progress-fill"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Controls */}
      <div className="timer-controls-row">
        <button
          className="timer-pill-btn"
          onClick={() => useStore.getState().toggleTimer()}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        >
          {isRunning ? (
            <>
              <PauseIcon size={14} strokeWidth={1.75} />
              <span>Pause</span>
            </>
          ) : (
            <>
              <PlayIcon size={14} strokeWidth={1.75} fill="currentColor" />
              <span>{secondsLeft < duration ? 'Resume' : 'Start'}</span>
            </>
          )}
        </button>

        <button
          className="timer-check-btn"
          onClick={() => useStore.getState().finishSession()}
          aria-label="Finish session"
          title="Finish session"
        >
          <CheckIcon size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Preset / Custom Duration Popover */}
      <div className="timer-popover-anchor" ref={popoverRef}>
        <button
          className="timer-set-time-btn"
          onClick={() => setShowPopover((v) => !v)}
          aria-label="Set timer duration"
        >
          <SlidersHorizontalIcon size={12} strokeWidth={1.75} />
          <span>Set time</span>
        </button>

        {showPopover && (
          <div className="timer-popover" role="dialog">
            <div className="preset-buttons">
              {TIMER_PRESETS.map((m) => (
                <button
                  key={m}
                  className="preset-btn"
                  onClick={() => handleSetPreset(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
            <form className="custom-min-form" onSubmit={handleCustomSubmit}>
              <input
                type="number"
                min={1}
                max={180}
                placeholder="Min"
                className="custom-min-input"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                onFocus={() => api()?.setInputFocused(true)}
                onBlur={() => api()?.setInputFocused(false)}
              />
              <button type="submit" className="custom-min-submit">
                Set
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Session Label */}
      <p className="session-caption" title={sessionText}>
        {sessionText}
      </p>
    </article>
  )
}

// ─── Notepad Card (Sand #E9E2C3) ──────────────────────────────────────────────

function NotepadCard({ showToast }: { showToast: (m: string) => void }) {
  const note = useStore((s) => s.note)
  const noteEditedAt = useStore((s) => s.noteEditedAt)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    useStore.getState().setNote(val)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      void flushToDisk().catch(() => showToast('Could not save note'))
    }, 400)
  }

  function handleBlur() {
    clearTimeout(debounceTimer.current)
    api()?.setInputFocused(false)
    void flushToDisk()
  }

  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0

  return (
    <article className="card card--sand">
      <div className="card-header">
        <span className="card-title">
          <PencilIcon size={13} strokeWidth={1.75} /> Notepad
        </span>
      </div>

      <textarea
        className="notepad-textarea"
        value={note}
        onChange={handleChange}
        onFocus={() => api()?.setInputFocused(true)}
        onBlur={handleBlur}
        placeholder="Write your quick thoughts or notes here…"
        aria-label="Notepad content"
      />

      <div className="notepad-footer">
        <span className="word-count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        {noteEditedAt && (
          <span className="edited-time">edited {formatDate(noteEditedAt)}</span>
        )}
      </div>
    </article>
  )
}

// ─── Events Card (Mist #D2DEE6) ───────────────────────────────────────────────

function EventsCard({ showToast }: { showToast: (m: string) => void }) {
  const events = useStore((s) => s.events)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', start: '', end: '' })
  const today = todayStr()
  const nowClock = formatClock()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    useStore.getState().addEvent({
      title: form.title.trim(),
      start: form.start,
      end: form.end,
    })
    setForm({ title: '', start: '', end: '' })
    setShowAdd(false)
    api()?.setInputFocused(false)
    showToast('Event added')
  }

  function isOverdue(ev: CalEvent) {
    return Boolean(ev.end && ev.end < nowClock)
  }

  function isHappeningNow(ev: CalEvent) {
    if (!ev.start) return false
    return ev.start <= nowClock && (!ev.end || ev.end >= nowClock)
  }

  const todayEvents = events.filter((e) => e.date === today)

  return (
    <article className="card card--mist">
      <div className="card-header">
        <span className="card-title">
          <BellIcon size={13} strokeWidth={1.75} /> Events
        </span>
        <button
          className="icon-action-btn"
          aria-label="Add event"
          onClick={() => {
            setShowAdd((v) => !v)
            if (!showAdd) api()?.setInputFocused(true)
            else api()?.setInputFocused(false)
          }}
          title="Add event"
        >
          <PlusIcon size={14} strokeWidth={1.75} />
        </button>
      </div>

      {showAdd && (
        <form className="event-inline-form" onSubmit={handleAdd}>
          <input
            required
            autoFocus
            className="event-title-input"
            placeholder="Event title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            onFocus={() => api()?.setInputFocused(true)}
            onBlur={() => api()?.setInputFocused(false)}
          />
          <div className="event-time-row">
            <input
              type="time"
              className="event-time-input"
              value={form.start}
              onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            />
            <span className="time-sep">–</span>
            <input
              type="time"
              className="event-time-input"
              value={form.end}
              onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
            />
          </div>
          <div className="event-form-btns">
            <button type="submit" className="event-save-btn">
              Add
            </button>
            <button
              type="button"
              className="event-cancel-btn"
              onClick={() => {
                setShowAdd(false)
                api()?.setInputFocused(false)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="events-list">
        {todayEvents.length === 0 && !showAdd && (
          <div className="empty-state">
            <p>No events today.</p>
          </div>
        )}

        {todayEvents.map((ev) => (
          <div
            key={ev.id}
            className={`event-row ${isHappeningNow(ev) ? 'event-row--now-alarm' : ''}`}
          >
            <div className="event-info">
              <span className="event-name" title={ev.title}>
                {ev.title}
              </span>
              {ev.start && (
                <span className="event-time-label">
                  {ev.start}
                  {ev.end ? ` – ${ev.end}` : ''}
                </span>
              )}
            </div>

            <div className="event-badge-wrap">
              {isHappeningNow(ev) && <span className="badge badge--now">Now</span>}
              {isOverdue(ev) && <span className="badge badge--overdue">Overdue</span>}
            </div>

            <button
              className="icon-action-btn event-delete-btn"
              aria-label="Delete event"
              onClick={() => useStore.getState().deleteEvent(ev.id)}
              title="Delete event"
            >
              <Trash2Icon size={12} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </article>
  )
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

function InsightsTab() {
  const sessions = useStore((s) => s.sessions)
  const tasks = useStore((s) => s.tasks)
  const completedCount = tasks.filter((t) => t.completed).length

  return (
    <div className="insights-container">
      <div className="insights-metrics-grid">
        <div className="insight-card">
          <span className="insight-title">FOCUS TODAY</span>
          <strong className="insight-number">{sessions * 25}m</strong>
          <span className="insight-sub">{sessions} sessions finished</span>
        </div>

        <div className="insight-card">
          <span className="insight-title">TASKS DONE</span>
          <strong className="insight-number">{completedCount}</strong>
          <span className="insight-sub">of {tasks.length} total tasks</span>
        </div>

        <div className="insight-card">
          <span className="insight-title">TOTAL SESSIONS</span>
          <strong className="insight-number">{sessions}</strong>
          <span className="insight-sub">completed pomodoros</span>
        </div>
      </div>

      <div className="weekly-chart-box">
        <div className="chart-header">
          <strong>Weekly Focus Activity</strong>
          <span>Minutes per day</span>
        </div>

        <div className="chart-bars-wrap">
          {[0, 0, 0, 0, 0, 0, sessions * 25].map((val, i) => {
            const max = Math.max(60, sessions * 25)
            const pct = Math.round((val / max) * 100)
            return (
              <div key={i} className="chart-column">
                <div className="chart-bar-bg">
                  <div className="chart-bar-fill" style={{ height: `${pct}%` }} />
                </div>
                <span className="chart-day-label">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ showToast }: { showToast: (m: string) => void }) {
  const launchAtStartup = useStore((s) => s.launchAtStartup)
  const openOnHover = useStore((s) => s.openOnHover)
  const hoverCloseDelay = useStore((s) => s.hoverCloseDelay) ?? 300
  const autoHideNotch = useStore((s) => s.autoHideNotch)
  const notch = useStore((s) => s.notch) ?? DEFAULT_NOTCH
  const theme = useStore((s) => s.theme) ?? 'classic'
  const notchContentMode = useStore((s) => s.notchContentMode) ?? 'smart'
  const notchSources = useStore((s) => s.notchSources) ?? ['clock', 'timer']
  const notchCycleInterval = useStore((s) => s.notchCycleInterval) ?? 5
  const reduceAnimations = useStore((s) => s.reduceAnimations) ?? false
  const telemetryConsent = useStore((s) => s.telemetryConsent)
  const telemetryInstallId = useStore((s) => s.telemetryInstallId)
  const autoUpdate = useStore((s) => s.autoUpdate)
  const updateStatus = useStore((s) => s.updateStatus)

  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [systemAccent, setSystemAccent] = useState<string | null>(null)
  const [showPrivacyPreview, setShowPrivacyPreview] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    api()?.getDisplays().then((d) => setDisplays(d || []))
    api()?.getAccentColor?.().then((acc) => {
      if (acc) setSystemAccent(acc)
    })
  }, [])

  async function handleLaunchAtStartup() {
    const next = !launchAtStartup
    useStore.getState().setLaunchAtStartup(next)
    try {
      await api()?.setLaunchAtStartup(next)
      showToast(next ? 'Startup enabled' : 'Startup disabled')
    } catch {
      showToast('Could not update startup setting')
      useStore.getState().setLaunchAtStartup(!next)
    }
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true)
    try {
      const res = await api()?.checkForUpdates()
      if (res?.status === 'available') {
        showToast(`Update v${res.version || ''} available! Downloading...`)
      } else if (res?.status === 'not-available') {
        showToast('You are on the latest version')
      } else if (res?.status === 'disabled') {
        showToast('Auto-updates not available for portable build')
      }
    } catch {
      showToast('Could not check for updates')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const currentTheme = getTheme(theme, systemAccent)

  const liveTelemetryPayload = {
    v: 1,
    installId: telemetryInstallId || 'generating...',
    event: 'launch',
    appVersion: '1.0.0',
    os: 'win11',
    arch: 'x64',
    locale: navigator.language || 'en',
  }

  return (
    <div className="settings-container">
      <div className="settings-scroll-area">
        {/* Appearance & Notch Placement */}
        <section className="settings-section">
          <div className="section-title">Notch Position & Appearance</div>

          <div className="setting-card">
            <div className="setting-row-top">
              <span className="setting-title">Alignment</span>
              <div className="segmented segmented--small" role="tablist">
                {(['left', 'center', 'right'] as NotchAlign[]).map((a) => (
                  <button
                    key={a}
                    role="tab"
                    aria-selected={notch.align === a}
                    className={`segmented-tab ${notch.align === a ? 'active' : ''}`}
                    onClick={() => useStore.getState().setNotchSettings({ align: a })}
                  >
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-slider-row">
              <div className="slider-label-wrap">
                <span className="setting-sub">Offset ({notch.offsetPx > 0 ? `+${notch.offsetPx}` : notch.offsetPx}px)</span>
                <button
                  className="reset-btn"
                  onClick={() => useStore.getState().setNotchSettings({ offsetPx: 0, align: 'center' })}
                  title="Reset offset to 0"
                >
                  <RotateCcwIcon size={11} strokeWidth={1.75} /> Reset
                </button>
              </div>
              <input
                type="range"
                min="-600"
                max="600"
                step="5"
                className="setting-range"
                value={notch.offsetPx}
                onChange={(e) => useStore.getState().setNotchSettings({ offsetPx: parseInt(e.target.value, 10) })}
              />
              <span className="hotkey-tip">Tip: Ctrl+Alt+Left/Right nudges by 20px, Ctrl+Alt+Home resets.</span>
            </div>

            {displays.length > 1 && (
              <div className="setting-row-top" style={{ marginTop: 8 }}>
                <span className="setting-title">Display</span>
                <select
                  className="display-select"
                  value={notch.displayId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null
                    useStore.getState().setNotchSettings({ displayId: val })
                  }}
                >
                  <option value="">Primary Display</option>
                  {displays.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.isPrimary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notch Color with Swatches and Live Mock Preview */}
          <div className="setting-card">
            <div className="theme-section-wrap">
              <div className="setting-row-top">
                <div>
                  <span className="setting-title">Notch color</span>
                  <span className="setting-desc" style={{ display: 'block', marginTop: 2 }}>
                    Selected: {currentTheme.name}
                  </span>
                </div>
              </div>

              {/* Live Preview in a small mock notch */}
              <div className="mock-notch-wrap">
                <div
                  className="mock-notch-preview"
                  style={{
                    background: currentTheme.background,
                    boxShadow: `0 0 10px ${currentTheme.glow}`,
                  }}
                >
                  <DotMatrix
                    value="12:00"
                    grid="5x7"
                    className="mock-notch-matrix"
                    litColor={currentTheme.dotLit}
                    unlitColor={currentTheme.dotUnlit}
                    glowColor={currentTheme.glow}
                    reduceMotion={reduceAnimations}
                  />
                </div>
              </div>

              {/* Redesigned Swatch Row showing rounded-square dots-on-background with small-caps name */}
              <div className="theme-swatch-row" role="radiogroup" aria-label="Notch Color Themes">
                {THEME_LIST.map((thId) => {
                  const th = getTheme(thId, systemAccent)
                  const isActive = theme === thId
                  return (
                    <div key={thId} className={`theme-swatch-item ${isActive ? 'active' : ''}`}>
                      <button
                        className={`theme-swatch-btn ${isActive ? 'active' : ''}`}
                        style={{
                          background: th.background,
                        }}
                        onClick={() => useStore.getState().setTheme(thId)}
                        title={th.name}
                        aria-label={`Theme: ${th.name}`}
                        role="radio"
                        aria-checked={isActive}
                      >
                        <div className="swatch-dots-grid">
                          <span className="swatch-grid-dot" style={{ background: th.dotLit }} />
                          <span className="swatch-grid-dot" style={{ background: th.dotUnlit }} />
                          <span className="swatch-grid-dot" style={{ background: th.dotLit }} />
                          <span className="swatch-grid-dot" style={{ background: th.dotUnlit }} />
                          <span className="swatch-grid-dot" style={{ background: th.dotLit }} />
                          <span className="swatch-grid-dot" style={{ background: th.dotUnlit }} />
                        </div>
                      </button>
                      <span className="theme-swatch-label">{th.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-title">Reduce animations</span>
              <span className="setting-desc">Disable idle glances and glow pulsing</span>
            </div>
            <button
              className={`switch-btn ${reduceAnimations ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={reduceAnimations}
              onClick={() => useStore.getState().setReduceAnimations(!reduceAnimations)}
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-title">Open on hover</span>
              <span className="setting-desc">Expand the widget when hovering over the notch</span>
            </div>
            <button
              className={`switch-btn ${openOnHover ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={openOnHover}
              onClick={() => useStore.getState().setOpenOnHover(!openOnHover)}
            >
              <span className="switch-knob" />
            </button>
          </div>

          {openOnHover && (
            <div className="setting-card" style={{ marginTop: 8, padding: '10px 12px' }}>
              <div className="setting-row-top">
                <div>
                  <span className="setting-title">Hover Auto-Close Delay</span>
                  <span className="setting-desc" style={{ display: 'block', marginTop: 2 }}>
                    {hoverCloseDelay === 0
                      ? 'Instant: Closes immediately when cursor leaves'
                      : hoverCloseDelay === 300
                      ? 'Standard: 0.3s delay before closing'
                      : hoverCloseDelay === 1000
                      ? 'Relaxed: 1.0s delay before closing'
                      : 'Extended: 2.0s delay before closing'}
                  </span>
                </div>
                <div className="segmented segmented--small" role="tablist">
                  {[
                    { label: 'Instant', ms: 0 },
                    { label: '0.3s', ms: 300 },
                    { label: '1.0s', ms: 1000 },
                    { label: '2.0s', ms: 2000 },
                  ].map((opt) => (
                    <button
                      key={opt.ms}
                      role="tab"
                      aria-selected={hoverCloseDelay === opt.ms}
                      className={`segmented-tab ${hoverCloseDelay === opt.ms ? 'active' : ''}`}
                      onClick={() => useStore.getState().setHoverCloseDelay(opt.ms)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-title">Auto-hide notch to 3px line</span>
              <span className="setting-desc">Shrinks after 4s idle; touches top-center to reveal</span>
            </div>
            <button
              className={`switch-btn ${autoHideNotch ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={autoHideNotch}
              onClick={() => useStore.getState().setAutoHideNotch(!autoHideNotch)}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </section>

        {/* Notch Content */}
        <section className="settings-section">
          <div className="section-title">Notch Content</div>

          <div className="setting-card">
            <div className="setting-row-top">
              <div>
                <span className="setting-title">Rotation Mode</span>
                <span className="setting-desc" style={{ display: 'block', marginTop: 2 }}>
                  {notchContentMode === 'smart'
                    ? 'Smart: Shows active timer if running, otherwise next task or clock'
                    : `Cycle: Rotates through enabled sources every ${notchCycleInterval}s`}
                </span>
              </div>
              <div className="segmented segmented--small" role="tablist">
                {(['smart', 'cycle'] as NotchContentMode[]).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={notchContentMode === m}
                    className={`segmented-tab ${notchContentMode === m ? 'active' : ''}`}
                    onClick={() => useStore.getState().setNotchContentMode(m)}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {notchContentMode === 'cycle' && (
              <div className="setting-slider-row" style={{ marginTop: 12 }}>
                <div className="slider-label-wrap">
                  <span className="setting-sub">Cycle Interval ({notchCycleInterval}s)</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  className="setting-range"
                  value={notchCycleInterval}
                  onChange={(e) =>
                    useStore.getState().setNotchCycleInterval(parseInt(e.target.value, 10))
                  }
                />
              </div>
            )}

            <div className="source-checklist">
              {NOTCH_SOURCES.map((src) => {
                const isNone = src.id === 'none'
                const isChecked = isNone
                  ? notchSources.includes('none')
                  : notchSources.includes(src.id) && !notchSources.includes('none')

                return (
                  <div key={src.id} className="source-item">
                    <div className="source-info">
                      <span className="source-title">{src.label}</span>
                      <span className="source-desc">{src.description}</span>
                    </div>
                    <button
                      className={`switch-btn ${isChecked ? 'switch--on' : ''}`}
                      role="switch"
                      aria-checked={isChecked}
                      onClick={() => useStore.getState().toggleNotchSource(src.id)}
                      aria-label={`Toggle ${src.label}`}
                    >
                      <span className="switch-knob" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* System & Startup */}
        <section className="settings-section">
          <div className="section-title">System & Updates</div>

          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-title">Launch at Windows startup</span>
              <span className="setting-desc">Start Beacon minimized on login</span>
            </div>
            <button
              className={`switch-btn ${launchAtStartup ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={launchAtStartup}
              onClick={() => void handleLaunchAtStartup()}
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-title">Automatically update</span>
              <span className="setting-desc">Download new releases in the background</span>
            </div>
            <button
              className={`switch-btn ${autoUpdate ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={autoUpdate}
              onClick={() => useStore.getState().setAutoUpdate(!autoUpdate)}
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="setting-card updates-card">
            <div className="updates-info">
              <div>
                <strong className="app-version">Beacon v2.0.4</strong>
                <span className="update-status-msg">
                  {updateStatus.status === 'checking'
                    ? 'Checking for updates…'
                    : updateStatus.status === 'downloaded'
                    ? `Update ready (v${updateStatus.version})`
                    : updateStatus.status === 'available'
                    ? `Downloading v${updateStatus.version}…`
                    : 'Up to date'}
                </span>
              </div>
              <button
                className="action-btn"
                disabled={checkingUpdate}
                onClick={handleCheckUpdate}
              >
                <RefreshCwIcon size={12} strokeWidth={1.75} className={checkingUpdate ? 'spin' : ''} />
                <span>Check for updates</span>
              </button>
            </div>
            <a
              href="https://github.com/kachakaran6/beacon/releases"
              target="_blank"
              rel="noreferrer"
              className="changelog-link"
              onClick={(e) => {
                e.preventDefault()
                api()?.openExternal('https://github.com/kachakaran6/beacon/releases')
              }}
            >
              View release notes & changelog →
            </a>
          </div>
        </section>

        {/* Privacy & Telemetry */}
        <section className="settings-section">
          <div className="section-title">Privacy & Telemetry</div>

          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-title">Anonymous usage statistics</span>
              <span className="setting-desc">Helps improve Beacon. No personal data, tasks or notes are ever sent.</span>
            </div>
            <button
              className={`switch-btn ${telemetryConsent === true ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={telemetryConsent === true}
              onClick={() => useStore.getState().setTelemetryConsent(telemetryConsent !== true)}
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="privacy-tools">
            <button
              className="privacy-text-btn"
              onClick={() => setShowPrivacyPreview((v) => !v)}
            >
              {showPrivacyPreview ? 'Hide payload preview' : 'Show exactly what is sent (live preview)'}
            </button>

            <button
              className="privacy-text-btn"
              onClick={() => {
                useStore.getState().resetTelemetryInstallId()
                showToast('Reset install ID')
              }}
            >
              Reset install ID
            </button>
          </div>

          {showPrivacyPreview && (
            <pre className="payload-preview">
              {JSON.stringify(liveTelemetryPayload, null, 2)}
            </pre>
          )}
        </section>
      </div>

      <div className="settings-footer-note">
        Beacon is offline-first and open source. All your tasks, notes and focus data stay local.
      </div>
    </div>
  )
}
