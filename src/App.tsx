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

function truncateTitle(title: string, maxChars = 11): string {
  if (title.length <= maxChars) return title
  return title.slice(0, maxChars - 1).trim() + '…'
}

// ─── Dot-matrix font glyph definitions ────────────────────────────────────────

const letterMatrix: Record<string, string[]> = {
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
}

const numMatrix: Record<string, string[]> = {
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
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '…': ['00000', '00000', '00000', '00000', '00000', '10101', '10101'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

const charMatrix = (c: string) =>
  numMatrix[c] ?? letterMatrix[c.toUpperCase()] ?? numMatrix[' ']

/** Responsive SVG DotMatrix. viewBox is dynamically sized, preserves aspect ratio. */
function DotMatrix({
  value,
  className = '',
  litColor,
  unlitColor,
}: {
  value: string
  className?: string
  litColor?: string
  unlitColor?: string
}) {
  const chars = value.split('')
  const cols = chars.length
  const charWidth = 15
  const charGap = 3
  const totalWidth = Math.max(18, cols * (charWidth + charGap) - charGap)
  const totalHeight = 21

  return (
    <svg
      className={`dot-matrix ${className}`}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label={value}
      role="img"
    >
      {chars.map((char, ci) => {
        const rows = charMatrix(char)
        const ox = ci * (charWidth + charGap)
        return rows.flatMap((row, ri) =>
          row.split('').map((lit, di) => {
            const isLit = lit === '1'
            return (
              <circle
                key={`${ci}-${ri}-${di}`}
                cx={ox + di * 3 + 1.5}
                cy={ri * 3 + 1.5}
                r={1.1}
                className={isLit ? 'dot-lit' : 'dot-unlit'}
                style={{
                  fill: isLit ? litColor : unlitColor,
                }}
              />
            )
          })
        )
      })}
    </svg>
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
  const [originXRatio, setOriginXRatio] = useState(0.5)
  const animatingClose = useRef(false)
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const collapseSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Store slices
  const isRunning = useStore((s) => s.isRunning)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const duration = useStore((s) => s.duration)
  const activeTaskId = useStore((s) => s.activeTaskId)
  const tasks = useStore((s) => s.tasks)
  const openOnHover = useStore((s) => s.openOnHover)
  const telemetryConsent = useStore((s) => s.telemetryConsent)

  const activeTask =
    tasks.find((t) => t.id === activeTaskId) ??
    tasks.find((t) => !t.completed) ??
    null

  // ── Initialise persistence & hydration ─────────────────────────────────────
  useEffect(() => {
    let unsub: (() => void) | undefined
    hydrateFromDisk().then(() => {
      unsub = startPersistence()
    })
    return () => unsub?.()
  }, [])

  // ── Clock tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClockStr(formatClock()), 10_000)
    return () => clearInterval(t)
  }, [])

  // ── Timer tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(() => useStore.getState().tick(), 1000)
    return () => clearInterval(t)
  }, [isRunning])

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

  // ── Shortcut & Window State listeners from main process ──────────────────
  useEffect(() => {
    const a = api()
    if (!a) return
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
      cleanupShortcut()
      cleanupState?.()
      cleanupUpdates?.()
    }
  }, [open, appMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Window expand / collapse interop ───────────────────────────────────────
  function openPanel(by: string = 'click') {
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current)
      hoverOpenTimer.current = null
    }
    animatingClose.current = false
    setOpen(true)
    api()?.expand(by)
  }

  function closePanel() {
    if (animatingClose.current || appMode) return
    animatingClose.current = true
    setOpen(false)
    if (collapseSafetyTimer.current) clearTimeout(collapseSafetyTimer.current)
    collapseSafetyTimer.current = setTimeout(() => {
      if (!appMode) {
        api()?.collapse()
        animatingClose.current = false
      }
    }, 220)
  }

  function onPanelExitComplete() {
    if (collapseSafetyTimer.current) {
      clearTimeout(collapseSafetyTimer.current)
      collapseSafetyTimer.current = null
    }
    if (!open && !appMode) {
      api()?.collapse()
      animatingClose.current = false
    }
  }

  const showToast = useCallback((text: string) => setToastMsg({ text }), [])

  // ── Hover to open handlers ─────────────────────────────────────────────────
  function handleNotchPointerEnter() {
    if (open || !openOnHover || appMode) return
    hoverOpenTimer.current = setTimeout(() => {
      openPanel('hover')
    }, 200)
  }

  function handleNotchPointerLeave() {
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current)
      hoverOpenTimer.current = null
    }
  }

  // ── Notch content ──────────────────────────────────────────────────────────
  const notchContent = () => {
    if (isRunning) return formatTime(secondsLeft)
    if (activeTask) return truncateTitle(activeTask.title, 11)
    return clockStr
  }

  const progress = Math.max(0, Math.min(1, 1 - secondsLeft / duration))

  return (
    <main
      className={`shell ${open ? 'shell--open' : ''} ${appMode ? 'shell--app' : ''}`}
    >
      {/* Notch Pill (Monochrome #000, 190x30, bottom radius 15px) */}
      {!open && !appMode && (
        <button
          className="notch"
          aria-label="Open Beacon"
          onClick={() => openPanel('click')}
          onPointerEnter={handleNotchPointerEnter}
          onPointerLeave={handleNotchPointerLeave}
          onContextMenu={(e) => {
            e.preventDefault()
          }}
        >
          {isRunning && (
            <svg className="notch-ring" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="7" className="notch-ring-track" />
              <circle
                cx="10"
                cy="10"
                r="7"
                className="notch-ring-fill"
                strokeDasharray={`${progress * 43.98} 43.98`}
              />
            </svg>
          )}
          <DotMatrix
            value={notchContent()}
            className="notch-matrix"
            litColor="rgba(255, 255, 255, 0.85)"
            unlitColor="rgba(255, 255, 255, 0.08)"
          />
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
            initial={appMode ? false : { opacity: 0, scaleY: 0.94, scaleX: 0.97 }}
            animate={{ opacity: 1, scaleY: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleY: 0.94, scaleX: 0.97 }}
            transition={{ duration: 0.18, ease: [0.33, 1, 0.68, 1] }}
            onContextMenu={(e) => {
              if (!appMode) {
                e.preventDefault()
                closePanel()
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

        {pending.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isActive={task.id === activeTaskId}
            menuOpen={menuId === task.id}
            onMenuToggle={() => setMenuId(menuId === task.id ? null : task.id)}
            onMenuClose={() => setMenuId(null)}
            showToast={showToast}
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
  task,
  isActive,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  showToast,
}: {
  task: Task
  isActive: boolean
  menuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  showToast: (m: string) => void
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
      className={`task-row ${task.completed ? 'task-row--done' : ''} ${
        isActive ? 'task-row--active' : ''
      }`}
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
          className="timer-matrix"
          litColor="#111111"
          unlitColor="rgba(0, 0, 0, 0.08)"
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
          <div key={ev.id} className="event-row">
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
  const autoHideNotch = useStore((s) => s.autoHideNotch)
  const notch = useStore((s) => s.notch) ?? DEFAULT_NOTCH
  const telemetryConsent = useStore((s) => s.telemetryConsent)
  const telemetryInstallId = useStore((s) => s.telemetryInstallId)
  const autoUpdate = useStore((s) => s.autoUpdate)
  const updateStatus = useStore((s) => s.updateStatus)

  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [showPrivacyPreview, setShowPrivacyPreview] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    api()?.getDisplays().then((d) => setDisplays(d || []))
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
                <strong className="app-version">Beacon v1.0.0</strong>
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
